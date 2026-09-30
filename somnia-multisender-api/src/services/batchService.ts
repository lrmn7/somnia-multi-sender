import crypto from "crypto";
import { isAddress, keccak256, stringToHex, createPublicClient, http } from "viem";
import { config } from "../config/index.js";
import { db } from "../db/index.js";
import { batches, chunks } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

export interface RecipientInput {
  address: string;
  amount: string;
}

export interface CreateBatchParams {
  senderWallet: string;
  tokenAddress?: string | null;
  distributionType: "equal" | "random" | "custom" | "import";
  recipients: RecipientInput[];
  idempotencyKey?: string;
}

export interface ChunkPlan {
  chunkIndex: number;
  recipients: string[];
  amounts: string[];
  totalAmount: string;
  recipientCount: number;
  estimatedGas?: string;
  newRecipientCount?: number;
  existingRecipientCount?: number;
  planningReason?: string;
}

export interface BatchPlan {
  publicBatchId: string;
  senderWallet: string;
  tokenAddress?: string | null;
  distributionType: string;
  totalAmount: string;
  totalRecipients: number;
  chunkCount: number;
  chunks: ChunkPlan[];
  isIdempotentReplay?: boolean;
  gasSafetyMarginPercent: number;
  configuredSafeGasLimit: string;
}

const publicClient = createPublicClient({
  transport: http(config.network.rpcUrl, { timeout: 5_000 }),
});

/**
 * Checks on-chain existence of candidate recipients in batched queries.
 */
export async function classifyRecipients(addresses: string[]): Promise<{
  newAddresses: Set<string>;
  existingAddresses: Set<string>;
}> {
  const newAddresses = new Set<string>();
  const existingAddresses = new Set<string>();

  try {
    const batchSize = 25;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const slice = addresses.slice(i, i + batchSize);
      await Promise.all(
        slice.map(async (addr) => {
          try {
            const bal = await publicClient.getBalance({ address: addr as `0x${string}` });
            if (bal > 0n) {
              existingAddresses.add(addr.toLowerCase());
            } else {
              const code = await publicClient.getBytecode({ address: addr as `0x${string}` });
              if (code && code !== "0x") {
                existingAddresses.add(addr.toLowerCase());
              } else {
                newAddresses.add(addr.toLowerCase());
              }
            }
          } catch {
            newAddresses.add(addr.toLowerCase());
          }
        })
      );
    }
  } catch {
    for (const a of addresses) newAddresses.add(a.toLowerCase());
  }

  return { newAddresses, existingAddresses };
}

export interface PlanningContext {
  senderWallet?: string;
  tokenAddress?: string | null;
}

/**
 * Gas-Aware Chunk Planning Algorithm:
 * 1. Build a candidate chunk (up to hardMaxRecipientsPerChunk).
 * 2. Estimate gas using on-chain eth_estimateGas when possible or Somnia state-creation cost model (~400k/new account).
 * 3. Compare against configuredSafeGasLimit applying safetyMarginPercent (+20%).
 * 4. If estimate exceeds budget, reduce chunk size adaptively.
 * 5. Re-estimate.
 * 6. Continue until candidate chunk is within allowed gas budget.
 * 7. Never exceed the absolute hard recipient maximum (500).
 * 8. Verify mathematical invariants (no recipient loss, no amount loss, chunk bounds).
 */
export async function planGasAwareChunks(
  recipients: RecipientInput[],
  isToken: boolean,
  context?: PlanningContext
): Promise<ChunkPlan[]> {
  const hardMax = config.limits.hardMaxRecipientsPerChunk; // 500 hard safety limit
  const safeGasBudget = config.limits.configuredSafeGasLimit; // 50M APPLICATION_SAFE_GAS_LIMIT
  const safetyMargin = config.limits.gasSafetyMarginPercent; // 20%

  let newAddresses = new Set<string>();
  if (!isToken) {
    const allAddresses = Array.from(new Set(recipients.map((r) => r.address.toLowerCase())));
    const classified = await classifyRecipients(allAddresses);
    newAddresses = classified.newAddresses;
  }

  const chunkPlans: ChunkPlan[] = [];
  let currentIndex = 0;

  while (currentIndex < recipients.length) {
    const remainingCount = recipients.length - currentIndex;
    let candidateSize = Math.min(remainingCount, hardMax);
    let finalEstimatedGas = 0n;
    let finalNewCount = 0;
    let finalExistingCount = 0;

    while (candidateSize > 0) {
      const candidateSlice = recipients.slice(currentIndex, currentIndex + candidateSize);

      let newCount = 0;
      let existingCount = 0;

      for (const r of candidateSlice) {
        if (newAddresses.has(r.address.toLowerCase())) {
          newCount++;
        } else {
          existingCount++;
        }
      }

      // Dynamic Somnia Gas Model (used as initial estimation baseline / fallback)
      const baseGas = 50_000n;
      let recipientGas: bigint;

      if (!isToken) {
        // Native SOMI/STT: existing = ~21k, new account creation = ~412k
        recipientGas = BigInt(existingCount) * 21_000n + BigInt(newCount) * 412_000n;
      } else {
        // ERC-20: ~240k per recipient (slot storage write + transferFrom)
        recipientGas = BigInt(candidateSize) * 240_000n;
      }

      let totalEstimated = baseGas + recipientGas;
      let liveGasObtained = false;

      // Authoritative Sequence: Exact transaction construction -> eth_estimateGas
      if (
        context?.senderWallet &&
        config.network.multisenderAddress &&
        config.network.multisenderAddress !== "0x0000000000000000000000000000000000000000" &&
        config.nodeEnv !== "test"
      ) {
        try {
          const candidateAddrs = candidateSlice.map((r) => r.address as `0x${string}`);
          const candidateAmts = candidateSlice.map((r) => BigInt(r.amount));
          const candidateSum = candidateAmts.reduce((a, b) => a + b, 0n);
          const dummyBatchId = "0x" + "11".repeat(32);

          if (!isToken) {
            const liveGas = await publicClient.estimateContractGas({
              address: config.network.multisenderAddress as `0x${string}`,
              abi: [
                {
                  type: "function",
                  name: "sendNative",
                  inputs: [
                    { name: "recipients", type: "address[]" },
                    { name: "amounts", type: "uint256[]" },
                    { name: "batchId", type: "bytes32" },
                    { name: "chunkIndex", type: "uint256" },
                  ],
                  outputs: [],
                  stateMutability: "payable",
                },
              ],
              functionName: "sendNative",
              args: [candidateAddrs, candidateAmts, dummyBatchId as `0x${string}`, 0n],
              value: candidateSum,
              account: context.senderWallet as `0x${string}`,
            });
            totalEstimated = liveGas;
            liveGasObtained = true;
          } else if (context.tokenAddress) {
            const liveGas = await publicClient.estimateContractGas({
              address: config.network.multisenderAddress as `0x${string}`,
              abi: [
                {
                  type: "function",
                  name: "sendToken",
                  inputs: [
                    { name: "token", type: "address" },
                    { name: "recipients", type: "address[]" },
                    { name: "amounts", type: "uint256[]" },
                    { name: "totalAmount", type: "uint256" },
                    { name: "batchId", type: "bytes32" },
                    { name: "chunkIndex", type: "uint256" },
                  ],
                  outputs: [],
                  stateMutability: "nonpayable",
                },
              ],
              functionName: "sendToken",
              args: [
                context.tokenAddress as `0x${string}`,
                candidateAddrs,
                candidateAmts,
                candidateSum,
                dummyBatchId as `0x${string}`,
                0n,
              ],
              account: context.senderWallet as `0x${string}`,
            });
            totalEstimated = liveGas;
            liveGasObtained = true;
          }
        } catch {
          // Live simulation may revert if sender has not yet approved or lacks balance at planning time.
          // In that case, fall back safely to our verified Somnia gas model.
        }
      }

      // Authoritative Safety Margin Validation (+20%)
      const totalWithMargin = (totalEstimated * BigInt(100 + safetyMargin)) / 100n;

      if (totalWithMargin <= safeGasBudget || candidateSize <= 10) {
        finalEstimatedGas = totalEstimated;
        finalNewCount = newCount;
        finalExistingCount = existingCount;
        break;
      }

      // Candidate exceeds budget: reduce candidateSize proportionally using live or model gas
      const effectiveGasForReduction = liveGasObtained ? totalEstimated : recipientGas;
      const safePerRecipient = effectiveGasForReduction / BigInt(candidateSize);
      const allowedCount = Number(
        (safeGasBudget * 100n / BigInt(100 + safetyMargin) - baseGas) /
          (safePerRecipient > 0n ? safePerRecipient : 1n)
      );
      const nextCandidateSize = Math.max(10, Math.min(candidateSize - 1, allowedCount));

      if (nextCandidateSize >= candidateSize) {
        candidateSize = Math.max(1, candidateSize - 10);
      } else {
        candidateSize = nextCandidateSize;
      }
    }

    const acceptedSlice = recipients.slice(currentIndex, currentIndex + candidateSize);
    let chunkTotalBigInt = 0n;
    const chunkRecipients: string[] = [];
    const chunkAmounts: string[] = [];

    for (const r of acceptedSlice) {
      chunkRecipients.push(r.address);
      chunkAmounts.push(r.amount);
      chunkTotalBigInt += BigInt(r.amount);
    }

    const reason =
      candidateSize < hardMax
        ? `Gas-aware constrained (${finalNewCount} new accounts detected, estimated gas ${finalEstimatedGas} within ${safeGasBudget} budget)`
        : `Full batch chunk (${finalExistingCount} existing accounts, well within gas budget)`;

    chunkPlans.push({
      chunkIndex: chunkPlans.length,
      recipients: chunkRecipients,
      amounts: chunkAmounts,
      totalAmount: chunkTotalBigInt.toString(),
      recipientCount: acceptedSlice.length,
      estimatedGas: finalEstimatedGas.toString(),
      newRecipientCount: finalNewCount,
      existingRecipientCount: finalExistingCount,
      planningReason: reason,
    });

    currentIndex += candidateSize;
  }

  // --- MATHEMATICAL INVARIANT VERIFICATION ---
  let aggregatedRecipientCount = 0;
  let aggregatedAmount = 0n;
  const seenRecipientsAcrossChunks = new Set<string>();

  for (const chunk of chunkPlans) {
    if (chunk.recipientCount <= 0) {
      throw new Error(`Mathematical invariant violation: chunk ${chunk.chunkIndex} has ${chunk.recipientCount} recipients`);
    }
    if (chunk.recipientCount > hardMax) {
      throw new Error(
        `Mathematical invariant violation: chunk ${chunk.chunkIndex} recipient count ${chunk.recipientCount} exceeds hard max ${hardMax}`
      );
    }
    if (chunk.recipients.length !== chunk.amounts.length) {
      throw new Error(
        `Mathematical invariant violation: chunk ${chunk.chunkIndex} recipients length !== amounts length`
      );
    }
    for (let i = 0; i < chunk.recipients.length; i++) {
      const rAddr = chunk.recipients[i].toLowerCase();
      if (seenRecipientsAcrossChunks.has(rAddr)) {
        throw new Error(`Mathematical invariant violation: recipient ${rAddr} duplicated across chunks`);
      }
      seenRecipientsAcrossChunks.add(rAddr);
      aggregatedAmount += BigInt(chunk.amounts[i]);
    }
    aggregatedRecipientCount += chunk.recipientCount;

    if (chunk.estimatedGas) {
      const est = BigInt(chunk.estimatedGas);
      const estWithMargin = (est * BigInt(100 + safetyMargin)) / 100n;
      if (estWithMargin > safeGasBudget && chunk.recipientCount > 10) {
        throw new Error(
          `Mathematical invariant violation: chunk ${chunk.chunkIndex} estimated gas with margin (${estWithMargin}) exceeds application safe gas limit (${safeGasBudget})`
        );
      }
    }
  }

  if (aggregatedRecipientCount !== recipients.length) {
    throw new Error(
      `Mathematical invariant violation: total chunk recipients (${aggregatedRecipientCount}) !== original recipient count (${recipients.length})`
    );
  }

  const originalTotal = recipients.reduce((acc, r) => acc + BigInt(r.amount), 0n);
  if (aggregatedAmount !== originalTotal) {
    throw new Error(
      `Mathematical invariant violation: total chunk amount (${aggregatedAmount}) !== original total amount (${originalTotal})`
    );
  }

  return chunkPlans;
}

// In-memory idempotency cache (keyed by sender + idempotencyKey or fingerprint)
const memoryBatchCache = new Map<string, BatchPlan>();
// In-flight mutex promise map to serialize concurrent duplicate requests
const inFlightRequests = new Map<string, Promise<BatchPlan>>();

export function computeInputFingerprint(params: CreateBatchParams): string {
  const payload = JSON.stringify({
    sender: params.senderWallet.toLowerCase(),
    token: params.tokenAddress ? params.tokenAddress.toLowerCase() : null,
    type: params.distributionType,
    recipients: params.recipients.map((r) => ({
      a: r.address.toLowerCase(),
      m: r.amount,
    })),
  });
  return keccak256(stringToHex(payload));
}

export async function createBatchPlan(params: CreateBatchParams): Promise<BatchPlan> {
  const { senderWallet, tokenAddress, distributionType, recipients, idempotencyKey } = params;

  if (!isAddress(senderWallet)) {
    throw new Error("Invalid sender wallet address");
  }

  const normalizedSender = senderWallet.toLowerCase();

  if (recipients.length === 0) {
    throw new Error("Recipient list cannot be empty");
  }

  if (recipients.length > config.limits.maxBatchRecipients) {
    throw new Error(`Recipient count exceeds maximum batch limit of ${config.limits.maxBatchRecipients}`);
  }

  const fingerprint = computeInputFingerprint(params);

  // Strict Idempotency Key Formulation
  const idempotencyCacheKey = idempotencyKey
    ? `${normalizedSender}:key:${idempotencyKey}`
    : `${normalizedSender}:fp:${fingerprint}`;

  // 1. Check in-flight promise to handle exact concurrent race condition
  const inFlight = inFlightRequests.get(idempotencyCacheKey);
  if (inFlight) {
    console.log(`[Idempotency] Concurrent in-flight hit for key ${idempotencyCacheKey}, awaiting existing resolution...`);
    const resolved = await inFlight;
    return { ...resolved, isIdempotentReplay: true };
  }

  // 2. Check fast memory cache
  const cached = memoryBatchCache.get(idempotencyCacheKey);
  if (cached) {
    console.log(`[Idempotency] Memory hit: returning existing batch ${cached.publicBatchId}`);
    return { ...cached, isIdempotentReplay: true };
  }

  // 3. Wrap creation in a mutex promise to prevent concurrent duplication
  const executionPromise = (async () => {
    // Check DB for existing matching batch
    try {
      const existing = await db.query.batches.findFirst({
        where: and(
          eq(batches.senderWallet, normalizedSender),
          idempotencyKey
            ? eq(batches.idempotencyKey, idempotencyKey)
            : eq(batches.inputFingerprint, fingerprint)
        ),
      });

      if (existing && existing.status !== "CANCELLED" && existing.status !== "REVERTED") {
        console.log(`[Idempotency] DB hit: returning existing batch ${existing.publicBatchId}`);
        const dbChunks = await db.select().from(chunks).where(eq(chunks.batchId, existing.id));

        const existingPlan: BatchPlan = {
          publicBatchId: existing.publicBatchId,
          senderWallet: existing.senderWallet,
          tokenAddress: existing.tokenAddress,
          distributionType: existing.distributionType,
          totalAmount: existing.totalAmountBaseUnits,
          totalRecipients: existing.recipientCount,
          chunkCount: dbChunks.length || 1,
          chunks: dbChunks.map((ch) => ({
            chunkIndex: ch.chunkIndex,
            recipients: [],
            amounts: [],
            totalAmount: ch.totalAmountBaseUnits,
            recipientCount: ch.recipientCount,
          })),
          isIdempotentReplay: true,
          gasSafetyMarginPercent: config.limits.gasSafetyMarginPercent,
          configuredSafeGasLimit: config.limits.configuredSafeGasLimit.toString(),
        };

        memoryBatchCache.set(idempotencyCacheKey, existingPlan);
        return existingPlan;
      }
    } catch (e: any) {
      if (process.env.NODE_ENV !== "test") {
        console.error("[Batch] Database unavailable during idempotency lookup (fail-closed):", e?.message);
        throw new Error("Database unavailable: cannot safely create batch without idempotency persistence");
      }
    }

    // 4. Validate recipients and calculate total
    let totalBigInt = 0n;
    const seenAddresses = new Set<string>();

    for (let i = 0; i < recipients.length; i++) {
      const item = recipients[i];
      if (!isAddress(item.address)) {
        throw new Error(`Invalid address at row ${i + 1}: ${item.address}`);
      }
      const normalized = item.address.toLowerCase();
      if (seenAddresses.has(normalized)) {
        throw new Error(`Duplicate address found at row ${i + 1}: ${item.address}`);
      }
      seenAddresses.add(normalized);

      let amountBigInt: bigint;
      try {
        amountBigInt = BigInt(item.amount);
        if (amountBigInt <= 0n) throw new Error("Amount must be greater than zero");
      } catch (e) {
        throw new Error(`Invalid amount at row ${i + 1}: ${item.amount}`);
      }
      totalBigInt += amountBigInt;
    }

    // 5. Gas-Aware Chunk Planning Algorithm
    const isToken = Boolean(tokenAddress && tokenAddress !== "0x0000000000000000000000000000000000000000");
    const chunkPlans = await planGasAwareChunks(recipients, isToken, {
      senderWallet: normalizedSender,
      tokenAddress: tokenAddress ? tokenAddress.toLowerCase() : null,
    });

    // Deterministic public batch ID if idempotencyKey provided
    const publicBatchId = idempotencyKey
      ? `batch_${idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48)}`
      : `batch_${crypto.randomBytes(16).toString("hex")}`;

    const plan: BatchPlan = {
      publicBatchId,
      senderWallet: normalizedSender,
      tokenAddress: tokenAddress ? tokenAddress.toLowerCase() : null,
      distributionType,
      totalAmount: totalBigInt.toString(),
      totalRecipients: recipients.length,
      chunkCount: chunkPlans.length,
      chunks: chunkPlans,
      gasSafetyMarginPercent: config.limits.gasSafetyMarginPercent,
      configuredSafeGasLimit: config.limits.configuredSafeGasLimit.toString(),
    };

    // 6. Persist to MySQL database
    try {
      const batchId = crypto.randomUUID();
      await db.insert(batches).values({
        id: batchId,
        publicBatchId: plan.publicBatchId,
        senderWallet: plan.senderWallet,
        idempotencyKey: idempotencyKey || null,
        environment: config.environment,
        chainId: config.network.chainId,
        tokenAddress: plan.tokenAddress,
        distributionType: plan.distributionType,
        totalAmountBaseUnits: plan.totalAmount,
        recipientCount: plan.totalRecipients,
        status: "VALIDATED",
        inputFingerprint: fingerprint,
      });

      if (chunkPlans.length > 0) {
        await db.insert(chunks).values(
          chunkPlans.map((ch) => ({
            id: crypto.randomUUID(),
            batchId: batchId,
            chunkIndex: ch.chunkIndex,
            recipientCount: ch.recipientCount,
            totalAmountBaseUnits: ch.totalAmount,
            status: "DRAFT",
          }))
        );
      }
    } catch (err: any) {
      if (process.env.NODE_ENV !== "test") {
        console.error("[Batch] Failed to persist batch to database (fail-closed):", err?.message);
        throw new Error("Failed to persist batch plan: database is required for reliable transaction lifecycle");
      }
    }

    // Cache in memory for fast local repeats
    memoryBatchCache.set(idempotencyCacheKey, plan);
    return plan;
  })();

  // Track in-flight request
  inFlightRequests.set(idempotencyCacheKey, executionPromise);
  try {
    return await executionPromise;
  } finally {
    inFlightRequests.delete(idempotencyCacheKey);
  }
}
