import { Hono } from "hono";
import { config } from "../config/index.js";
import { checkDatabaseConnection } from "../db/index.js";

export const healthRouter = new Hono();

healthRouter.get("/", async (c) => {
  const dbOk = await checkDatabaseConnection();

  return c.json({
    status: "ok",
    environment: config.environment,
    chainId: config.network.chainId,
    database: dbOk ? "connected" : "disconnected",
    timestamp: new Date().toISOString(),
  });
});
