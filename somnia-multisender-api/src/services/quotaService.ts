import { config } from "../config/index.js";
import { db } from "../db/index.js";
import { sponsorshipLedger, users } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";

export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export interface QuotaStatus {
  walletAddress: string;
  monthKey: string;
  totalAllowance: number;
  usedCredits: number;
  remainingCredits: number;
  canSponsorCount: (requestedCount: number) => boolean;
}

export class DatabaseUnavailableError extends Error {
  constructor(message = "MySQL is unavailable for quota verification (fail-closed)") {
    super(message);
    this.name = "DatabaseUnavailableError";
  }
}

/**
 * Retrieves the current sponsorship quota for a wallet.
 * In production/staging, if the database is unavailable, this FAILS CLOSED
 * to prevent unmetered consumption of community sponsorship funds.
 */
export async function getWalletQuota(walletAddress: string): Promise<QuotaStatus> {
  const normalized = walletAddress.toLowerCase();
  const monthKey = getCurrentMonthKey();
  const totalAllowance = config.limits.monthlySponsoredCredits;

  try {
    const result = await db
      .select({
        totalUsed: sql<number>`COALESCE(SUM(${sponsorshipLedger.recipientCount}), 0)`,
      })
      .from(sponsorshipLedger)
      .where(
        and(
          eq(sponsorshipLedger.walletAddress, normalized),
          eq(sponsorshipLedger.monthKey, monthKey),
          sql`${sponsorshipLedger.status} IN ('RESERVED', 'COMMITTED')`
        )
      );

    const usedCredits = Number(result[0]?.totalUsed || 0);
    const remainingCredits = Math.max(0, totalAllowance - usedCredits);

    return {
      walletAddress: normalized,
      monthKey,
      totalAllowance,
      usedCredits,
      remainingCredits,
      canSponsorCount: (requestedCount: number) => requestedCount <= remainingCredits,
    };
  } catch (err: any) {
    if (process.env.NODE_ENV === "test") {
      // In test mode without DB, allow mock quota for unit tests
      return {
        walletAddress: normalized,
        monthKey,
        totalAllowance,
        usedCredits: 0,
        remainingCredits: totalAllowance,
        canSponsorCount: (requestedCount: number) => requestedCount <= totalAllowance,
      };
    }
    // FAIL CLOSED in staging/production: never silently grant free quota when database is down!
    console.error("[Quota] Database connection error during quota check (failing closed):", err?.message);
    throw new DatabaseUnavailableError();
  }
}

/**
 * Concurrency-Safe Atomic Quota Reservation.
 * Uses an advisory transaction lock or atomic transaction to guarantee
 * that two concurrent requests for the same wallet cannot overdraw remaining quota.
 */
export async function atomicReserveSponsorshipCredits(
  walletAddress: string,
  batchId: string,
  chunkId: string | undefined,
  recipientCount: number,
  estimatedGas: string
): Promise<{ success: boolean; reason?: string; remainingCredits?: number }> {
  const normalized = walletAddress.toLowerCase();
  const monthKey = getCurrentMonthKey();
  const totalAllowance = config.limits.monthlySponsoredCredits;

  try {
    return await db.transaction(async (tx) => {
      // 1. Ensure user record exists, then acquire InnoDB row-level lock (FOR UPDATE)
      // This serializes all concurrent reservation attempts for this specific wallet.
      await tx.execute(
        sql`INSERT INTO users (id, wallet_address, created_at, last_seen_at) 
            VALUES (UUID(), ${normalized}, NOW(), NOW()) 
            ON DUPLICATE KEY UPDATE last_seen_at = NOW()`
      );

      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.walletAddress, normalized))
        .for("update");

      // 2. Query current reserved/committed count under the lock
      const result = await tx
        .select({
          totalUsed: sql<number>`COALESCE(SUM(${sponsorshipLedger.recipientCount}), 0)`,
        })
        .from(sponsorshipLedger)
        .where(
          and(
            eq(sponsorshipLedger.walletAddress, normalized),
            eq(sponsorshipLedger.monthKey, monthKey),
            sql`${sponsorshipLedger.status} IN ('RESERVED', 'COMMITTED')`
          )
        );

      const usedCredits = Number(result[0]?.totalUsed || 0);
      const remainingCredits = Math.max(0, totalAllowance - usedCredits);

      if (recipientCount > remainingCredits) {
        return {
          success: false,
          reason: `Insufficient sponsorship quota. Requested: ${recipientCount}, Remaining: ${remainingCredits}`,
          remainingCredits,
        };
      }

      // 3. Atomically insert reservation
      await tx.insert(sponsorshipLedger).values({
        walletAddress: normalized,
        batchId: batchId || null,
        chunkId: chunkId || null,
        recipientCount,
        estimatedGas,
        status: "RESERVED",
        monthKey,
      });

      return {
        success: true,
        remainingCredits: remainingCredits - recipientCount,
      };
    });
  } catch (err: any) {
    console.error("[Quota] Atomic reservation failed (failing closed):", err?.message);
    throw new DatabaseUnavailableError(err?.message);
  }
}

export async function commitSponsorshipCredits(batchId: string, actualGas: string): Promise<void> {
  try {
    await db
      .update(sponsorshipLedger)
      .set({
        status: "COMMITTED",
        actualGas,
      })
      .where(eq(sponsorshipLedger.batchId, batchId as any));
  } catch (err: any) {
    console.warn("[Quota] Commit status update warning:", err?.message);
  }
}

export async function releaseSponsorshipCredits(batchId: string): Promise<void> {
  try {
    await db
      .update(sponsorshipLedger)
      .set({ status: "CANCELLED" })
      .where(and(eq(sponsorshipLedger.batchId, batchId as any), eq(sponsorshipLedger.status, "RESERVED")));
  } catch (err: any) {
    console.warn("[Quota] Release quota update warning:", err?.message);
  }
}
