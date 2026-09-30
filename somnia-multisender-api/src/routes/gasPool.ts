import { Hono } from "hono";
import { getGasPoolMetrics } from "../services/gasPoolService.js";

export const gasPoolRouter = new Hono();

gasPoolRouter.get("/", async (c) => {
  try {
    const metrics = await getGasPoolMetrics();
    return c.json(metrics);
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to retrieve gas pool data" }, 500);
  }
});
