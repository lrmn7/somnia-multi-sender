import { createPublicClient, http, formatEther, isAddress } from "viem";
import { config } from "../config/index.js";
import { db } from "../db/index.js";
import { donations, sponsorshipLedger } from "../db/schema.js";
import { sql, desc } from "drizzle-orm";

export interface GasPoolMetrics {
  poolAddress: string;
  onChainBalance: string;
  totalDonated: string;
  totalDonors: number;
  totalSponsoredRecipients: number;
  totalSponsorshipGasSpent: string;
  recentDonations: Array<{
    txHash: string;
    donor: string;
    amount: string;
    timestamp: Date;
  }>;
}

export async function getGasPoolMetrics(): Promise<GasPoolMetrics> {
  const poolAddress = config.network.gasPoolAddress;
  let onChainBalance = "0.0";

  if (isAddress(poolAddress) && poolAddress !== "0x0000000000000000000000000000000000000000") {
    try {
      const publicClient = createPublicClient({
        transport: http(config.network.rpcUrl),
      });
      const bal = await publicClient.getBalance({ address: poolAddress as `0x${string}` });
      onChainBalance = formatEther(bal);
    } catch (e) {
      console.warn("Could not query on-chain gas pool balance:", e);
    }
  }

  try {
    const donationSummary = await db
      .select({
        totalAmount: sql<string>`CAST(COALESCE(SUM(${donations.amountBaseUnits}), 0) AS CHAR)`,
        donorCount: sql<number>`COUNT(DISTINCT ${donations.donorAddress})`,
      })
      .from(donations);

    const sponsorshipSummary = await db
      .select({
        totalRecipients: sql<number>`COALESCE(SUM(${sponsorshipLedger.recipientCount}), 0)`,
        totalGas: sql<string>`CAST(COALESCE(SUM(${sponsorshipLedger.gasCostBaseUnits}), 0) AS CHAR)`,
      })
      .from(sponsorshipLedger)
      .where(sql`${sponsorshipLedger.status} = 'COMMITTED'`);

    const recent = await db
      .select()
      .from(donations)
      .orderBy(desc(donations.createdAt))
      .limit(10);

    return {
      poolAddress,
      onChainBalance,
      totalDonated: donationSummary[0]?.totalAmount || "0",
      totalDonors: Number(donationSummary[0]?.donorCount || 0),
      totalSponsoredRecipients: Number(sponsorshipSummary[0]?.totalRecipients || 0),
      totalSponsorshipGasSpent: sponsorshipSummary[0]?.totalGas || "0",
      recentDonations: recent.map((d) => ({
        txHash: d.txHash,
        donor: d.donorAddress,
        amount: d.amountBaseUnits,
        timestamp: d.createdAt,
      })),
    };
  } catch (err) {
    return {
      poolAddress,
      onChainBalance,
      totalDonated: "0",
      totalDonors: 0,
      totalSponsoredRecipients: 0,
      totalSponsorshipGasSpent: "0",
      recentDonations: [],
    };
  }
}
