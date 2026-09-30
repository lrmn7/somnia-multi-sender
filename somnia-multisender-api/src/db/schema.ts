import {
  mysqlTable,
  varchar,
  text,
  timestamp,
  bigint,
  int,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";
import crypto from "crypto";

// 1. users
export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_wallet_idx").on(table.walletAddress)]
);

// 2. auth_nonces
export const authNonces = mysqlTable(
  "auth_nonces",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    nonce: varchar("nonce", { length: 128 }).notNull().unique(),
    issuedAt: varchar("issued_at", { length: 64 }),
    messageText: text("message_text"),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("nonces_wallet_idx").on(table.walletAddress),
    uniqueIndex("nonces_nonce_idx").on(table.nonce),
  ]
);

// 3. sessions
export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    sessionToken: varchar("session_token", { length: 128 }).notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at"),
    sessionVersion: int("session_version").default(1).notNull(),
  },
  (table) => [
    index("sessions_wallet_idx").on(table.walletAddress),
    uniqueIndex("sessions_token_idx").on(table.sessionToken),
  ]
);

// 4. batches
export const batches = mysqlTable(
  "batches",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    publicBatchId: varchar("public_batch_id", { length: 64 }).notNull().unique(),
    senderWallet: varchar("sender_wallet", { length: 42 }).notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 128 }),
    environment: varchar("environment", { length: 32 }).notNull(),
    chainId: int("chain_id").notNull(),
    tokenAddress: varchar("token_address", { length: 42 }), // null = native SOMI/STT
    distributionType: varchar("distribution_type", { length: 32 }).notNull(), // equal, random, custom, import
    totalAmountBaseUnits: varchar("total_amount_base_units", { length: 78 }).notNull(), // Exact integer base units representation (up to 78 chars for uint256)
    recipientCount: int("recipient_count").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"), // DRAFT, VALIDATED, SUBMITTED, PENDING, CONFIRMED, REVERTED, UNKNOWN, CANCELLED, PARTIAL
    inputFingerprint: varchar("input_fingerprint", { length: 128 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("batches_sender_idx").on(table.senderWallet),
    index("batches_idempotency_idx").on(table.senderWallet, table.idempotencyKey),
    index("batches_fingerprint_idx").on(table.senderWallet, table.inputFingerprint),
    uniqueIndex("batches_public_id_idx").on(table.publicBatchId),
  ]
);

// 5. chunks
export const chunks = mysqlTable(
  "chunks",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    batchId: varchar("batch_id", { length: 36 })
      .references(() => batches.id)
      .notNull(),
    chunkIndex: int("chunk_index").notNull(),
    recipientCount: int("recipient_count").notNull(),
    totalAmountBaseUnits: varchar("total_amount_base_units", { length: 78 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("DRAFT"),
    txHash: varchar("tx_hash", { length: 66 }),
    blockNumber: bigint("block_number", { mode: "number" }),
    blockHash: varchar("block_hash", { length: 66 }),
    logIndex: int("log_index"),
    relayerNonce: int("relayer_nonce"),
    submittedAt: timestamp("submitted_at"),
    confirmedAt: timestamp("confirmed_at"),
    revertedAt: timestamp("reverted_at"),
    errorCode: varchar("error_code", { length: 64 }),
    errorSummary: text("error_summary"),
  },
  (table) => [
    uniqueIndex("chunks_batch_chunk_idx").on(table.batchId, table.chunkIndex),
    index("chunks_tx_hash_idx").on(table.txHash),
  ]
);

// 6. batch_recipients
export const batchRecipients = mysqlTable(
  "batch_recipients",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    batchId: varchar("batch_id", { length: 36 })
      .references(() => batches.id)
      .notNull(),
    chunkId: varchar("chunk_id", { length: 36 }).references(() => chunks.id),
    recipientAddress: varchar("recipient_address", { length: 42 }).notNull(),
    amountBaseUnits: varchar("amount_base_units", { length: 78 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("PENDING"),
    chainTxHash: varchar("chain_tx_hash", { length: 66 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("recipients_batch_idx").on(table.batchId),
    index("recipients_addr_idx").on(table.recipientAddress),
  ]
);

// 7. token_registry
export const tokenRegistry = mysqlTable(
  "token_registry",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    environment: varchar("environment", { length: 32 }).notNull(),
    chainId: int("chain_id").notNull(),
    tokenAddress: varchar("token_address", { length: 42 }).notNull(),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    decimals: int("decimals").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    verifiedAt: timestamp("verified_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("token_env_addr_idx").on(table.environment, table.tokenAddress),
  ]
);

// 8. presets
export const presets = mysqlTable(
  "presets",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    distributionType: varchar("distribution_type", { length: 32 }).notNull(),
    configurationJson: text("configuration_json").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("presets_wallet_idx").on(table.walletAddress)]
);

// 9. donations
export const donations = mysqlTable(
  "donations",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    environment: varchar("environment", { length: 32 }).notNull(),
    chainId: int("chain_id").notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    donorAddress: varchar("donor_address", { length: 42 }).notNull(),
    amountBaseUnits: varchar("amount_base_units", { length: 78 }).notNull(),
    blockNumber: bigint("block_number", { mode: "number" }).notNull(),
    blockHash: varchar("block_hash", { length: 66 }),
    logIndex: int("log_index").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("donations_tx_log_idx").on(table.txHash, table.logIndex),
    index("donations_donor_idx").on(table.donorAddress),
  ]
);

// 10. sponsorship_ledger
export const sponsorshipLedger = mysqlTable(
  "sponsorship_ledger",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
    batchId: varchar("batch_id", { length: 66 }),
    chunkId: varchar("chunk_id", { length: 66 }),
    recipientCount: int("recipient_count").notNull(),
    estimatedGas: varchar("estimated_gas", { length: 78 }),
    actualGas: varchar("actual_gas", { length: 78 }),
    gasCostBaseUnits: varchar("gas_cost_base_units", { length: 78 }),
    status: varchar("status", { length: 32 }).notNull(), // RESERVED, COMMITTED, CANCELLED
    monthKey: varchar("month_key", { length: 10 }).notNull(), // format YYYY-MM
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("sponsorship_wallet_month_idx").on(table.walletAddress, table.monthKey),
  ]
);

// 11. daily_stats
export const dailyStats = mysqlTable(
  "daily_stats",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    environment: varchar("environment", { length: 32 }).notNull(),
    date: varchar("date", { length: 10 }).notNull(), // YYYY-MM-DD
    walletAddress: varchar("wallet_address", { length: 42 }), // null = global aggregation
    totalSent: varchar("total_sent", { length: 78 }).default("0").notNull(),
    totalRecipients: int("total_recipients").default(0).notNull(),
    totalBatches: int("total_batches").default(0).notNull(),
    totalSponsoredRecipients: int("total_sponsored_recipients").default(0).notNull(),
    totalSponsorshipGas: varchar("total_sponsorship_gas", { length: 78 }).default("0").notNull(),
    totalDonated: varchar("total_donated", { length: 78 }).default("0").notNull(),
  },
  (table) => [
    uniqueIndex("daily_stats_date_wallet_idx").on(table.environment, table.date, table.walletAddress),
  ]
);

// 12. reconciliation_checkpoints
export const reconciliationCheckpoints = mysqlTable(
  "reconciliation_checkpoints",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    workerName: varchar("worker_name", { length: 64 }).notNull(),
    environment: varchar("environment", { length: 32 }).notNull(),
    lastBlock: bigint("last_block", { mode: "number" }).notNull(),
    lastLogCursor: varchar("last_log_cursor", { length: 128 }),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("reconciliation_worker_env_idx").on(table.workerName, table.environment),
  ]
);

// 13. admin_audit_logs (Append-Only Log)
export const adminAuditLogs = mysqlTable(
  "admin_audit_logs",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    correlationId: varchar("correlation_id", { length: 64 }),
    adminUserId: varchar("admin_user_id", { length: 64 }).notNull(),
    role: varchar("role", { length: 32 }).notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    resourceType: varchar("resource_type", { length: 64 }).notNull(),
    resourceId: varchar("resource_id", { length: 64 }).notNull(),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    reason: text("reason").notNull(),
    result: varchar("result", { length: 32 }).default("SUCCESS").notNull(),
    txHash: varchar("tx_hash", { length: 66 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("audit_admin_idx").on(table.adminUserId),
    index("audit_role_idx").on(table.role),
    index("audit_created_idx").on(table.createdAt),
  ]
);

// 14. transaction_attempts (Chunk broadcast / retry attempts)
export const transactionAttempts = mysqlTable(
  "transaction_attempts",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    chunkId: varchar("chunk_id", { length: 36 })
      .references(() => chunks.id)
      .notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    nonce: int("nonce").notNull(),
    gasPriceBaseUnits: varchar("gas_price_base_units", { length: 78 }),
    status: varchar("status", { length: 32 }).notNull().default("SUBMITTED"), // SUBMITTED, MINED, REPLACED, FAILED
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("tx_attempts_chunk_idx").on(table.chunkId),
    uniqueIndex("tx_attempts_tx_hash_idx").on(table.txHash),
  ]
);

// 15. incidents (Operational / security incident tracker)
export const incidents = mysqlTable(
  "incidents",
  {
    id: varchar("id", { length: 36 })
      .$defaultFn(() => crypto.randomUUID())
      .primaryKey(),
    severity: varchar("severity", { length: 32 }).notNull(), // LOW, MEDIUM, HIGH, CRITICAL
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description").notNull(),
    resolved: boolean("resolved").default(false).notNull(),
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("incidents_severity_idx").on(table.severity),
    index("incidents_resolved_idx").on(table.resolved),
  ]
);
