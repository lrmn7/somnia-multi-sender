import { createPublicClient, http, parseAbiItem, decodeFunctionData } from "viem";
import { config } from "../config/index.js";
import { db } from "../db/index.js";
import crypto from "crypto";
import { donations, reconciliationCheckpoints, batches, chunks, batchRecipients } from "../db/schema.js";
import { eq, and } from "drizzle-orm";

const DONATION_EVENT_ABI = parseAbiItem(
  "event DonationReceived(address indexed donor, uint256 amount, uint256 currentBalance)"
);

const BATCH_CHUNK_EXECUTED_ABI = parseAbiItem(
  "event BatchChunkExecuted(bytes32 indexed batchId, uint256 indexed chunkIndex, address indexed sender, address token, uint256 recipientCount, uint256 totalAmount)"
);

// Multisender function definitions for calldata decoding
const MULTISENDER_FUNCTIONS_ABI = [
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
  {
    type: "function",
    name: "sendNativeEqual",
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "amountPerRecipient", type: "uint256" },
      { name: "batchId", type: "bytes32" },
      { name: "chunkIndex", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
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
  {
    type: "function",
    name: "sendTokenSponsored",
    inputs: [
      { name: "sender", type: "address" },
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
] as const;

export class IndexerWorker {
  private publicClient = createPublicClient({
    transport: http(config.network.rpcUrl),
  });

  private isRunning = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  start(intervalMs = 15_000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[Indexer] Worker started (Polling events every ${intervalMs}ms)`);

    this.intervalTimer = setInterval(() => {
      this.syncEvents().catch((err) => {
        console.error("[Indexer] Sync error:", err);
      });
    }, intervalMs);
  }

  stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log("[Indexer] Worker stopped");
  }

  async syncEvents() {
    try {
      const currentBlock = await this.publicClient.getBlockNumber();
      let fromBlock = currentBlock > 50n ? currentBlock - 50n : 0n;

      try {
        const checkpoint = await db.query.reconciliationCheckpoints.findFirst({
          where: eq(reconciliationCheckpoints.workerName, "event_indexer"),
        });
        if (checkpoint && BigInt(checkpoint.lastBlock) > fromBlock) {
          fromBlock = BigInt(checkpoint.lastBlock);
        }
      } catch (e) {
        // Table not ready or empty
      }

      if (fromBlock >= currentBlock) return;

      await this.rebuildStateFromChain(fromBlock, currentBlock);

      // Save checkpoint
      try {
        await db
          .insert(reconciliationCheckpoints)
          .values({
            workerName: "event_indexer",
            environment: config.environment,
            lastBlock: Number(currentBlock),
            updatedAt: new Date(),
          })
          .onDuplicateKeyUpdate({
            set: {
              lastBlock: Number(currentBlock),
              updatedAt: new Date(),
            },
          });
      } catch (e) {
        // Ignored
      }
    } catch (err) {
      console.warn("[Indexer] Polling warning:", err);
    }
  }

  /**
   * Deterministically reconstructs batch distribution and donation state directly
   * from Somnia blockchain logs and transaction calldata.
   */
  async rebuildStateFromChain(fromBlock: bigint, toBlock: bigint) {
    console.log(`[Indexer] Rebuilding state from block ${fromBlock} to ${toBlock}...`);

    // 1. Index GasPool Donations
    const gasPoolAddr = config.network.gasPoolAddress as `0x${string}`;
    if (gasPoolAddr && gasPoolAddr !== "0x0000000000000000000000000000000000000000") {
      try {
        const donationLogs = await this.publicClient.getLogs({
          address: gasPoolAddr,
          event: DONATION_EVENT_ABI,
          fromBlock,
          toBlock,
        });

        for (const log of donationLogs) {
          const donor = log.args.donor as string;
          const amount = log.args.amount ? log.args.amount.toString() : "0";

          try {
            await db.insert(donations).values({
              environment: config.environment,
              chainId: config.network.chainId,
              txHash: log.transactionHash!,
              donorAddress: donor.toLowerCase(),
              amountBaseUnits: amount,
              blockNumber: Number(log.blockNumber),
              blockHash: log.blockHash,
              logIndex: log.logIndex!,
            });
            console.log(`[Indexer] Indexed donation of ${amount} from ${donor}`);
          } catch (e) {
            // Already indexed
          }
        }
      } catch (e) {
        console.warn("[Indexer] GasPool logs notice:", e);
      }
    }

    // 2. Index Multisender Executions & Decode Calldata
    const multisenderAddr = config.network.multisenderAddress as `0x${string}`;
    if (multisenderAddr && multisenderAddr !== "0x0000000000000000000000000000000000000000") {
      try {
        const batchLogs = await this.publicClient.getLogs({
          address: multisenderAddr,
          event: BATCH_CHUNK_EXECUTED_ABI,
          fromBlock,
          toBlock,
        });

        for (const log of batchLogs) {
          const batchId = log.args.batchId as `0x${string}`;
          const chunkIndex = Number(log.args.chunkIndex || 0);
          const sender = (log.args.sender as string).toLowerCase();
          const token = (log.args.token as string).toLowerCase();
          const totalAmount = log.args.totalAmount ? log.args.totalAmount.toString() : "0";
          const txHash = log.transactionHash!;
          const blockNumber = Number(log.blockNumber);
          const blockHash = log.blockHash;
          const logIndex = log.logIndex;

          // Fetch transaction calldata from chain
          try {
            const tx = await this.publicClient.getTransaction({ hash: txHash });
            const decoded = decodeFunctionData({
              abi: MULTISENDER_FUNCTIONS_ABI,
              data: tx.input,
            });

            let recipients: string[] = [];
            let amounts: string[] = [];
            let distType = "custom";

            if (decoded.functionName === "sendNative") {
              const args = decoded.args as readonly [readonly `0x${string}`[], readonly bigint[], `0x${string}`, bigint];
              recipients = args[0] as string[];
              amounts = args[1].map((a) => a.toString());
              distType = "custom";
            } else if (decoded.functionName === "sendNativeEqual") {
              const args = decoded.args as readonly [readonly `0x${string}`[], bigint, `0x${string}`, bigint];
              recipients = args[0] as string[];
              const equalAmount = args[1].toString();
              amounts = recipients.map(() => equalAmount);
              distType = "equal";
            } else if (decoded.functionName === "sendToken") {
              const args = decoded.args as readonly [`0x${string}`, readonly `0x${string}`[], readonly bigint[], bigint, `0x${string}`, bigint];
              recipients = args[1] as string[];
              amounts = args[2].map((a) => a.toString());
              distType = "custom";
            } else if (decoded.functionName === "sendTokenSponsored") {
              const args = decoded.args as readonly [`0x${string}`, `0x${string}`, readonly `0x${string}`[], readonly bigint[], bigint, `0x${string}`, bigint];
              recipients = args[2] as string[];
              amounts = args[3].map((a) => a.toString());
              distType = "sponsored";
            }

            console.log(
              `[Indexer] Reconstructed Chunk #${chunkIndex} from on-chain tx ${txHash} (${recipients.length} recipients, type: ${distType})`
            );

            // Reconstruct Database Cache if missing
            const publicBatchId = `onchain_${batchId.slice(0, 16)}`;
            let batchRecord = await db.query.batches.findFirst({
              where: eq(batches.publicBatchId, publicBatchId),
            });

            if (!batchRecord) {
              const newBatchId = crypto.randomUUID();
              await db
                .insert(batches)
                .values({
                  id: newBatchId,
                  publicBatchId,
                  senderWallet: sender,
                  environment: config.environment,
                  chainId: config.network.chainId,
                  tokenAddress: token === "0x0000000000000000000000000000000000000000" ? null : token,
                  distributionType: distType,
                  totalAmountBaseUnits: totalAmount,
                  recipientCount: recipients.length,
                  status: "CONFIRMED",
                });
              batchRecord = {
                id: newBatchId,
                publicBatchId,
                senderWallet: sender,
                environment: config.environment,
                chainId: config.network.chainId,
                tokenAddress: token === "0x0000000000000000000000000000000000000000" ? null : token,
                distributionType: distType,
                totalAmountBaseUnits: totalAmount,
                recipientCount: recipients.length,
                status: "CONFIRMED",
                idempotencyKey: null,
                inputFingerprint: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
            }

            // Upsert Chunk with full block and log metadata
            let chunkRecord = await db.query.chunks.findFirst({
              where: and(
                eq(chunks.batchId, batchRecord.id),
                eq(chunks.chunkIndex, chunkIndex)
              ),
            });

            if (!chunkRecord) {
              const newChunkId = crypto.randomUUID();
              await db
                .insert(chunks)
                .ignore()
                .values({
                  id: newChunkId,
                  batchId: batchRecord.id,
                  chunkIndex,
                  recipientCount: recipients.length,
                  totalAmountBaseUnits: totalAmount,
                  status: "CONFIRMED",
                  txHash,
                  blockNumber,
                  blockHash,
                  logIndex,
                  confirmedAt: new Date(),
                });
              chunkRecord = await db.query.chunks.findFirst({
                where: and(
                  eq(chunks.batchId, batchRecord.id),
                  eq(chunks.chunkIndex, chunkIndex)
                ),
              });
            }

            // Insert reconstructed recipients
            if (chunkRecord) {
              for (let i = 0; i < recipients.length; i++) {
                await db
                  .insert(batchRecipients)
                  .ignore()
                  .values({
                    id: crypto.randomUUID(),
                    batchId: batchRecord.id,
                    chunkId: chunkRecord.id,
                    recipientAddress: recipients[i].toLowerCase(),
                    amountBaseUnits: amounts[i],
                    status: "CONFIRMED",
                    chainTxHash: txHash,
                  })
                  .catch(() => {});
              }
            }
          } catch (decodeErr) {
            console.warn(`[Indexer] Could not decode calldata for tx ${txHash}:`, decodeErr);
          }
        }
      } catch (e) {
        console.warn("[Indexer] Multisender logs notice:", e);
      }
    }
  }
}

export const indexerWorker = new IndexerWorker();
