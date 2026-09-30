import { createPublicClient, http } from "viem";
import { config } from "../config/index.js";
import { db } from "../db/index.js";
import { chunks, batches } from "../db/schema.js";
import { eq, or, and, isNotNull } from "drizzle-orm";
import { commitSponsorshipCredits, releaseSponsorshipCredits } from "../services/quotaService.js";

export class ReconcilerWorker {
  private publicClient = createPublicClient({
    transport: http(config.network.rpcUrl),
  });

  private isRunning = false;
  private intervalTimer: NodeJS.Timeout | null = null;

  start(intervalMs = 10_000) {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[Reconciler] Worker started (Polling every ${intervalMs}ms)`);

    this.intervalTimer = setInterval(() => {
      this.reconcilePendingTransactions().catch((err) => {
        console.error("[Reconciler] Polling error:", err);
      });
    }, intervalMs);
  }

  stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.isRunning = false;
    console.log("[Reconciler] Worker stopped");
  }

  async reconcilePendingTransactions() {
    try {
      // 1. Strictly fetch only chunks with valid transaction hashes awaiting confirmation
      const pendingChunks = await db
        .select()
        .from(chunks)
        .where(
          and(
            or(eq(chunks.status, "SUBMITTED"), eq(chunks.status, "PENDING"), eq(chunks.status, "UNKNOWN")),
            isNotNull(chunks.txHash)
          )
        )
        .limit(25);

      const affectedBatchIds = new Set<string>();

      for (const chunk of pendingChunks) {
        if (!chunk.txHash) continue;

        try {
          // Never blindly retry: inspect actual on-chain transaction receipt first
          const receipt = await this.publicClient.getTransactionReceipt({
            hash: chunk.txHash as `0x${string}`,
          });

          if (receipt) {
            if (receipt.status === "success") {
              await db
                .update(chunks)
                .set({
                  status: "CONFIRMED",
                  blockNumber: Number(receipt.blockNumber),
                  blockHash: receipt.blockHash,
                  confirmedAt: new Date(),
                })
                .where(eq(chunks.id, chunk.id));

              // Commit sponsorship quota if this was a sponsored chunk
              await commitSponsorshipCredits(chunk.batchId, receipt.gasUsed.toString());
              console.log(`[Reconciler] Chunk ${chunk.id} (tx: ${chunk.txHash}) CONFIRMED on-chain.`);
              affectedBatchIds.add(chunk.batchId);
            } else {
              await db
                .update(chunks)
                .set({
                  status: "REVERTED",
                  blockNumber: Number(receipt.blockNumber),
                  blockHash: receipt.blockHash,
                  revertedAt: new Date(),
                  errorCode: "TX_REVERTED_ON_CHAIN",
                })
                .where(eq(chunks.id, chunk.id));

              // Release reserved quota
              await releaseSponsorshipCredits(chunk.batchId);
              console.warn(`[Reconciler] Chunk ${chunk.id} (tx: ${chunk.txHash}) REVERTED on-chain.`);
              affectedBatchIds.add(chunk.batchId);
            }
          }
        } catch (rpcErr) {
          // Transaction pending or not yet mined: preserve status, never assume failure or blindly retry
        }
      }

      // 2. Recalculate parent batch status from child chunk states
      for (const batchId of affectedBatchIds) {
        await this.recalculateBatchStatus(batchId);
      }
    } catch (err) {
      console.warn("[Reconciler] Worker cycle warning:", err);
    }
  }

  async recalculateBatchStatus(batchId: string) {
    try {
      const allChunks = await db.select().from(chunks).where(eq(chunks.batchId, batchId));
      if (allChunks.length === 0) return;

      const allConfirmed = allChunks.every((ch) => ch.status === "CONFIRMED");
      const anyReverted = allChunks.some((ch) => ch.status === "REVERTED");
      const anyProcessing = allChunks.some((ch) => ch.status === "SUBMITTED" || ch.status === "PENDING");
      const anyUnknown = allChunks.some((ch) => ch.status === "UNKNOWN");

      let newStatus = "CONFIRMED";
      if (anyProcessing) {
        newStatus = "PROCESSING";
      } else if (anyUnknown) {
        newStatus = "UNKNOWN";
      } else if (anyReverted) {
        const someConfirmed = allChunks.some((ch) => ch.status === "CONFIRMED");
        newStatus = someConfirmed ? "PARTIALLY_COMPLETED" : "FAILED";
      } else if (allConfirmed) {
        newStatus = "CONFIRMED";
      }

      await db
        .update(batches)
        .set({
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(batches.id, batchId));

      console.log(`[Reconciler] Recalculated Batch ${batchId} status -> ${newStatus}`);
    } catch (err) {
      console.warn(`[Reconciler] Could not update batch ${batchId} status:`, err);
    }
  }
}

export const reconcilerWorker = new ReconcilerWorker();
