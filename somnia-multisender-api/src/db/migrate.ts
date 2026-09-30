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
    const missing = requiredTables.filter((t) => !existingTables.includes(t));

    if (missing.length === 0) {
      console.log(`[Migration Verified] All ${requiredTables.length} tables already exist in database.`);
      return;
    }

    console.log(`[Migration] Missing tables (${missing.length}): ${missing.join(", ")}. Executing migration...`);

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
        if (
          err.code === "ER_TABLE_EXISTS_ERROR" ||
          err.code === "ER_DUP_KEYNAME" ||
          err.code === "ER_FK_DUP_NAME" ||
          err.code === "ER_CANT_CREATE_TABLE" ||
          err.errno === 121 ||
          err.errno === 1050 ||
          err.errno === 1061 ||
          err.errno === 1826
        ) {
          // Already exists or duplicate constraint
        } else {
          console.error(`[Migration Error on statement ${i + 1}]:`, err.message);
          throw err;
        }
      }
    }

    console.log("[Migration Verified] DDL statements executed successfully.");
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
