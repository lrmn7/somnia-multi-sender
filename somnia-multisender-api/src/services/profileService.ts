import { db } from "../db/index.js";
import { batches, batchRecipients, donations, sponsorshipLedger } from "../db/schema.js";
import { eq, sql, desc, and, gte } from "drizzle-orm";

export interface WalletProfileMetrics {
  walletAddress: string;
  period: string;
  totalSentBaseUnits: string;
  totalReceivedBaseUnits: string;
  totalBatchesExecuted: number;
  totalRecipientsReached: number;
  totalSponsoredRecipients: number;
  totalDonatedBaseUnits: string;
}

export function getPeriodStartDate(period: "7D" | "30D" | "90D" | "ALL"): Date | null {
  const now = new Date();
  if (period === "7D") return new Date(now.getTime() - 7 * 86400 * 1000);
  if (period === "30D") return new Date(now.getTime() - 30 * 86400 * 1000);
  if (period === "90D") return new Date(now.getTime() - 90 * 86400 * 1000);
  return null;
}

export async function getWalletProfile(
  walletAddress: string,
  period: "7D" | "30D" | "90D" | "ALL" = "ALL"
): Promise<WalletProfileMetrics> {
  const normalized = walletAddress.toLowerCase();
  const startDate = getPeriodStartDate(period);

  try {
    // 1. Sent Batches
    const sentCondition = startDate
      ? and(eq(batches.senderWallet, normalized), gte(batches.createdAt, startDate))
      : eq(batches.senderWallet, normalized);

    const sentStats = await db
      .select({
        totalAmount: sql<string>`CAST(COALESCE(SUM(${batches.totalAmountBaseUnits}), 0) AS CHAR)`,
        batchCount: sql<number>`COUNT(*)`,
        recipientCount: sql<number>`COALESCE(SUM(${batches.recipientCount}), 0)`,
      })
      .from(batches)
      .where(sentCondition);

    // 2. Received
    const receivedCondition = startDate
      ? and(eq(batchRecipients.recipientAddress, normalized), gte(batchRecipients.createdAt, startDate))
      : eq(batchRecipients.recipientAddress, normalized);

    const receivedStats = await db
      .select({
        totalReceived: sql<string>`CAST(COALESCE(SUM(${batchRecipients.amountBaseUnits}), 0) AS CHAR)`,
      })
      .from(batchRecipients)
      .where(receivedCondition);

    // 3. Sponsored Recipients
    const sponsorCondition = startDate
      ? and(eq(sponsorshipLedger.walletAddress, normalized), gte(sponsorshipLedger.createdAt, startDate))
      : eq(sponsorshipLedger.walletAddress, normalized);

    const sponsorStats = await db
      .select({
        totalSponsored: sql<number>`COALESCE(SUM(${sponsorshipLedger.recipientCount}), 0)`,
      })
      .from(sponsorshipLedger)
      .where(and(sponsorCondition, sql`${sponsorshipLedger.status} = 'COMMITTED'`));

    // 4. Donations
    const donationCondition = startDate
      ? and(eq(donations.donorAddress, normalized), gte(donations.createdAt, startDate))
      : eq(donations.donorAddress, normalized);

    const donationStats = await db
      .select({
        totalDonated: sql<string>`CAST(COALESCE(SUM(${donations.amountBaseUnits}), 0) AS CHAR)`,
      })
      .from(donations)
      .where(donationCondition);

    return {
      walletAddress: normalized,
      period,
      totalSentBaseUnits: sentStats[0]?.totalAmount || "0",
      totalReceivedBaseUnits: receivedStats[0]?.totalReceived || "0",
      totalBatchesExecuted: Number(sentStats[0]?.batchCount || 0),
      totalRecipientsReached: Number(sentStats[0]?.recipientCount || 0),
      totalSponsoredRecipients: Number(sponsorStats[0]?.totalSponsored || 0),
      totalDonatedBaseUnits: donationStats[0]?.totalDonated || "0",
    };
  } catch (err) {
    return {
      walletAddress: normalized,
      period,
      totalSentBaseUnits: "0",
      totalReceivedBaseUnits: "0",
      totalBatchesExecuted: 0,
      totalRecipientsReached: 0,
      totalSponsoredRecipients: 0,
      totalDonatedBaseUnits: "0",
    };
  }
}

export async function getWalletBatchHistory(walletAddress: string, limit = 20, offset = 0) {
  const normalized = walletAddress.toLowerCase();

  try {
    return await db
      .select()
      .from(batches)
      .where(eq(batches.senderWallet, normalized))
      .orderBy(desc(batches.createdAt))
      .limit(limit)
      .offset(offset);
  } catch (err) {
    return [];
  }
}
