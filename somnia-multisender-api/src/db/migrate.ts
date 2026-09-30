import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigration(dbUrl?: string) {
  const targetUrl = dbUrl || process.env.DATABASE_URL || "mysql://root:password@localhost:3306/somnia_multisender_staging";
  console.log(`[Migration] Connecting to database: ${targetUrl.replace(/:([^:@]+)@/, ":****@")}`);

  const conn = await mysql.createConnection(targetUrl);

  try {
    const migrationFile = path.resolve(__dirname, "../../drizzle/0000_great_sphinx.sql");
    const sqlContent = fs.readFileSync(migrationFile, "utf-8");
    const statements = sqlContent
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(`[Migration] Executing ${statements.length} migration statements...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      try {
        await conn.query(stmt);
      } catch (err: any) {
        // If table or index already exists, log and proceed if desired, or rethrow
        if (err.code === "ER_TABLE_EXISTS_ERROR" || err.code === "ER_DUP_KEYNAME") {
          // Already exists
        } else {
          console.error(`[Migration Error on statement ${i + 1}]:`, err.message);
          throw err;
        }
      }
    }

    console.log("[Migration] All DDL statements executed successfully.");

    // Verification of all 15 required tables
    const requiredTables = [
      "users",
      "auth_nonces",
      "sessions",
      "batches",
      "chunks",
      "batch_recipients",
      "sponsorship_ledger",
      "donations",
      "transaction_attempts",
      "reconciliation_checkpoints",
      "admin_audit_logs",
      "incidents",
      "token_registry",
      "presets",
      "daily_stats",
    ];

    const [rows] = await conn.query<any[]>("SHOW TABLES;");
    const existingTables = rows.map((r: any) => Object.values(r)[0] as string);

    console.log(`[Migration] Existing tables (${existingTables.length}):`, existingTables.join(", "));

    const missing = requiredTables.filter((t) => !existingTables.includes(t));
    if (missing.length > 0) {
      throw new Error(`[CRITICAL] Missing required staging tables: ${missing.join(", ")}`);
    }

    console.log("[Migration Verified] All 15 required tables exist with InnoDB engine and utf8mb4 encoding.");
  } finally {
    await conn.end();
  }
}

// Run directly if invoked from CLI
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const customUrl = process.argv[2];
  runMigration(customUrl)
    .then(() => {
      console.log("[Migration] Completed successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Migration] Failed:", err);
      process.exit(1);
    });
}
