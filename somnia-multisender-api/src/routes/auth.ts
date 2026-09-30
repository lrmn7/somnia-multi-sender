import { Hono } from "hono";
import { z } from "zod";
import { generateNonce, verifySignature } from "../services/authService.js";

export const authRouter = new Hono();

const nonceSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
});

const verifySchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format"),
  nonce: z.string().min(8, "Nonce required"),
  signature: z.string().regex(/^0x[a-fA-F0-9]+$/, "Invalid signature format"),
});

authRouter.post("/nonce", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = nonceSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, 400);
    }

    const result = await generateNonce(parsed.data.walletAddress);
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to generate nonce" }, 500);
  }
});

authRouter.post("/verify", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message || "Invalid input" }, 400);
    }

    const result = await verifySignature(
      parsed.data.walletAddress,
      parsed.data.nonce,
      parsed.data.signature as `0x${string}`
    );
    return c.json(result);
  } catch (err: any) {
    return c.json({ error: err?.message || "Authentication failed" }, 401);
  }
});
