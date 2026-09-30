import { Hono } from "hono";
import { z } from "zod";
import { createBatchPlan } from "../services/batchService.js";
import { db } from "../db/index.js";
import { batches, chunks } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const batchesRouter = new Hono();

const createBatchSchema = z.object({
  senderWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid sender wallet"),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).nullable().optional(),
  distributionType: z.enum(["equal", "random", "custom", "import"]),
  recipients: z.array(
    z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid recipient address"),
      amount: z.string().regex(/^[0-9]+$/, "Amount must be a positive integer base unit"),
    })
  ).min(1, "At least 1 recipient is required"),
  idempotencyKey: z.string().optional(),
});

batchesRouter.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const parsed = createBatchSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, 400);
    }

    const plan = await createBatchPlan(parsed.data);
    return c.json(plan, 201);
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to create batch plan" }, 400);
  }
});

batchesRouter.get("/:id", async (c) => {
  const id = c.req.param("id");

  try {
    const batch = await db.query.batches.findFirst({
      where: eq(batches.publicBatchId, id),
    });

    if (!batch) {
      return c.json({ error: "Batch not found" }, 404);
    }

    const batchChunks = await db
      .select()
      .from(chunks)
      .where(eq(chunks.batchId, batch.id));

    return c.json({
      batch,
      chunks: batchChunks,
    });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to retrieve batch" }, 500);
  }
});
