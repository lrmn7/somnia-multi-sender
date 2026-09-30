import { Hono } from "hono";
import { z } from "zod";
import { getWalletQuota, atomicReserveSponsorshipCredits, DatabaseUnavailableError } from "../services/quotaService.js";
import { relayerService } from "../services/relayerService.js";
import { getSessionUser } from "../services/authService.js";
import { config } from "../config/index.js";

export const sponsorRouter = new Hono();

const quoteSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  recipientCount: z.number().int().positive(),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

const submitSchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  recipients: z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/)).min(1),
  amounts: z.array(z.string().regex(/^[0-9]+$/)).min(1),
  totalAmount: z.string().regex(/^[0-9]+$/),
  batchIdHex: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  chunkIndex: z.number().int().min(0),
  dbChunkId: z.string().optional(),
});

// Quote endpoint
sponsorRouter.post("/quote", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = quoteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, 400);
    }

    const { walletAddress, recipientCount } = parsed.data;
    const quota = await getWalletQuota(walletAddress);
    const eligible = quota.canSponsorCount(recipientCount);

    return c.json({
      eligible,
      requestedRecipients: recipientCount,
      remainingCredits: quota.remainingCredits,
      totalAllowance: quota.totalAllowance,
      quotaMonth: quota.monthKey,
      relayerAddress: relayerService.getRelayerAddress(),
    });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) {
      return c.json({ error: "Sponsorship service temporarily unavailable: database offline (fail-closed)", code: "DATABASE_UNAVAILABLE" }, 503);
    }
    return c.json({ error: err?.message || "Failed to calculate quote" }, 500);
  }
});

// Submit sponsored chunk endpoint
sponsorRouter.post("/submit", async (c) => {
  try {
    // 1. Authenticate wallet ownership via Session Token
    const authHeader = c.req.header("authorization") || c.req.header("x-session-token");
    const sessionToken = authHeader?.replace(/^Bearer\s+/i, "");
    const authenticatedUser = await getSessionUser(sessionToken);

    if (!authenticatedUser) {
      return c.json(
        {
          error: "Unauthorized: Valid wallet-signature session required to submit sponsored transactions",
          code: "AUTH_REQUIRED",
        },
        401
      );
    }

    const body = await c.req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, 400);
    }

    const { tokenAddress, recipients, amounts, totalAmount, batchIdHex, chunkIndex, dbChunkId } = parsed.data;

    // 2. Validate recipient count hard limit
    if (recipients.length > config.limits.maxRecipientsPerChunk) {
      return c.json(
        {
          error: `Recipient count ${recipients.length} exceeds chunk maximum limit of ${config.limits.maxRecipientsPerChunk}`,
        },
        400
      );
    }

    if (recipients.length !== amounts.length) {
      return c.json({ error: "Recipients and amounts array length mismatch" }, 400);
    }

    // 3. Sender is strictly bound to the authenticated user (prevents quota theft)
    const senderAddress = authenticatedUser.toLowerCase();

    // 4. Concurrency-Safe Atomic Quota Reservation
    const reservation = await atomicReserveSponsorshipCredits(
      senderAddress,
      batchIdHex,
      dbChunkId,
      recipients.length,
      "500000"
    );

    if (!reservation.success) {
      return c.json(
        {
          error: reservation.reason || "Insufficient monthly sponsored credits",
          code: "QUOTA_EXCEEDED",
          remainingCredits: reservation.remainingCredits,
        },
        403
      );
    }

    // 5. Submit to Relayer Service
    const result = await relayerService.submitSponsoredChunk({
      senderAddress,
      tokenAddress,
      recipients,
      amounts,
      totalAmount,
      batchIdHex: batchIdHex as `0x${string}`,
      chunkIndex,
      dbChunkId,
    });

    return c.json({
      ...result,
      authenticatedSender: senderAddress,
      remainingCredits: reservation.remainingCredits,
    });
  } catch (err: any) {
    if (err instanceof DatabaseUnavailableError) {
      return c.json({ error: "Sponsorship service temporarily unavailable: database offline (fail-closed)", code: "DATABASE_UNAVAILABLE" }, 503);
    }
    return c.json({ error: err?.message || "Failed to execute sponsored transaction" }, 500);
  }
});
