import { Hono } from "hono";
import { getWalletProfile, getWalletBatchHistory } from "../services/profileService.js";
import { getWalletQuota } from "../services/quotaService.js";
import { isAddress } from "viem";

export const profileRouter = new Hono();

profileRouter.get("/:wallet", async (c) => {
  const wallet = c.req.param("wallet");
  if (!isAddress(wallet)) {
    return c.json({ error: "Invalid wallet address" }, 400);
  }

  const periodQuery = c.req.query("period") || "ALL";
  const validPeriods = ["7D", "30D", "90D", "ALL"];
  const period = validPeriods.includes(periodQuery.toUpperCase())
    ? (periodQuery.toUpperCase() as "7D" | "30D" | "90D" | "ALL")
    : "ALL";

  const [metrics, quota] = await Promise.all([
    getWalletProfile(wallet, period),
    getWalletQuota(wallet),
  ]);

  return c.json({
    metrics,
    quota: {
      totalAllowance: quota.totalAllowance,
      usedCredits: quota.usedCredits,
      remainingCredits: quota.remainingCredits,
      monthKey: quota.monthKey,
    },
  });
});

profileRouter.get("/history/:wallet", async (c) => {
  const wallet = c.req.param("wallet");
  if (!isAddress(wallet)) {
    return c.json({ error: "Invalid wallet address" }, 400);
  }

  const limit = Math.min(parseInt(c.req.query("limit") || "20", 10), 100);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const history = await getWalletBatchHistory(wallet, limit, offset);
  return c.json({ batches: history });
});
