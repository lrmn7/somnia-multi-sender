import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { bodyLimit } from "hono/body-limit";
import crypto from "crypto";
import { config, validateChainStartup } from "./config/index.js";
import { runMigration } from "./db/migrate.js";
import { configRouter } from "./routes/config.js";
import { authRouter } from "./routes/auth.js";
import { profileRouter } from "./routes/profile.js";
import { batchesRouter } from "./routes/batches.js";
import { gasPoolRouter } from "./routes/gasPool.js";
import { sponsorRouter } from "./routes/sponsor.js";
import { healthRouter } from "./routes/health.js";
import { adminRouter } from "./routes/admin.js";
import { reconcilerWorker } from "./workers/reconciler.js";
import { indexerWorker } from "./workers/indexer.js";

const app = new Hono();

// 1. Correlation ID & Observability Middleware
app.use("*", async (c, next) => {
  const correlationId =
    c.req.header("x-correlation-id") ||
    c.req.header("x-request-id") ||
    `req_${crypto.randomBytes(12).toString("hex")}`;
  c.header("x-correlation-id", correlationId);
  await next();
});

// 2. Structured logging
app.use("*", logger());

// 3. Request body size limiter (Strict 2 MB ceiling to prevent memory DoS)
app.use(
  "*",
  bodyLimit({
    maxSize: 2 * 1024 * 1024, // 2 MB
    onError: (c) => {
      return c.json({ error: "Payload Too Large: maximum allowed request size is 2 MB", code: "PAYLOAD_TOO_LARGE" }, 413);
    },
  })
);

// 4. Strict CORS allowlist (Never use wildcard for credentialed APIs)
app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return null;

      const allowedOrigins = new Set([
        ...config.corsOrigins,
        process.env.PUBLIC_APP_ORIGIN || "http://localhost:5173",
        process.env.ADMIN_APP_ORIGIN || "http://localhost:5174",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
      ]);

      if (allowedOrigins.has(origin)) {
        return origin;
      }

      console.warn(`[CORS Blocked] Unauthorized origin: ${origin}`);
      return null;
    },
    credentials: true,
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-session-token",
      "x-admin-key",
      "x-admin-role",
      "x-admin-user",
      "x-correlation-id",
      "x-request-id",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  })
);

// 5. Mount versioned API routes
app.route("/v1/config", configRouter);
app.route("/v1/auth", authRouter);
app.route("/v1/profile", profileRouter);
app.route("/v1/batches", batchesRouter);
app.route("/v1/gas-pool", gasPoolRouter);
app.route("/v1/sponsor", sponsorRouter);
app.route("/v1/health", healthRouter);
app.route("/v1/admin", adminRouter);

// Root route
app.get("/", (c) => {
  return c.json({
    service: "somnia-multisender-api",
    version: "1.0.0",
    environment: config.environment,
    chain: {
      chainId: config.network.chainId,
      name: config.network.name,
      nativeSymbol: config.network.nativeSymbol,
    },
    status: "Internally Remediated / Staging Ready",
    docs: "/v1/config",
  });
});

async function start() {
  console.log("==========================================");
  console.log(`Starting Somnia Multisender API Service...`);
  console.log(`Environment: ${config.environment.toUpperCase()}`);
  console.log(`Target Chain: ${config.network.name} (${config.network.chainId})`);
  console.log(`Native Currency: ${config.network.nativeSymbol}`);
  console.log("==========================================");

  // Validate chain startup
  await validateChainStartup();

  // Ensure database tables exist
  try {
    await runMigration();
  } catch (err) {
    console.warn("[Migration Notice] Auto-migration check:", err instanceof Error ? err.message : String(err));
  }

  // Start background workers
  reconcilerWorker.start();
  indexerWorker.start();

  serve(
    {
      fetch: app.fetch,
      port: config.port,
    },
    (info) => {
      console.log(`[API Ready] Server listening on http://localhost:${info.port}`);
    }
  );
}

const isTestRunner =
  process.env.NODE_ENV === "test" ||
  process.argv.includes("--test") ||
  process.execArgv.includes("--test");

if (isTestRunner) {
  process.env.NODE_ENV = "test";
} else {
  start().catch((err) => {
    console.error("[FATAL] Application startup failure:", err);
    process.exit(1);
  });
}

export { app, start };
export default app;
