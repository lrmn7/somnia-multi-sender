CREATE TABLE `admin_audit_logs` (
	`id` varchar(36) NOT NULL,
	`correlation_id` varchar(64),
	`admin_user_id` varchar(64) NOT NULL,
	`role` varchar(32) NOT NULL,
	`action` varchar(64) NOT NULL,
	`resource_type` varchar(64) NOT NULL,
	`resource_id` varchar(64) NOT NULL,
	`before_json` text,
	`after_json` text,
	`reason` text NOT NULL,
	`result` varchar(32) NOT NULL DEFAULT 'SUCCESS',
	`tx_hash` varchar(66),
	`ip_address` varchar(45),
	`user_agent` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `auth_nonces` (
	`id` varchar(36) NOT NULL,
	`wallet_address` varchar(42) NOT NULL,
	`nonce` varchar(128) NOT NULL,
	`issued_at` varchar(64),
	`message_text` text,
	`expires_at` timestamp NOT NULL,
	`used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auth_nonces_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_nonces_nonce_unique` UNIQUE(`nonce`),
	CONSTRAINT `nonces_nonce_idx` UNIQUE(`nonce`)
);
--> statement-breakpoint
CREATE TABLE `batch_recipients` (
	`id` varchar(36) NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`chunk_id` varchar(36),
	`recipient_address` varchar(42) NOT NULL,
	`amount_base_units` varchar(78) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'PENDING',
	`chain_tx_hash` varchar(66),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `batch_recipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `batches` (
	`id` varchar(36) NOT NULL,
	`public_batch_id` varchar(64) NOT NULL,
	`sender_wallet` varchar(42) NOT NULL,
	`idempotency_key` varchar(128),
	`environment` varchar(32) NOT NULL,
	`chain_id` int NOT NULL,
	`token_address` varchar(42),
	`distribution_type` varchar(32) NOT NULL,
	`total_amount_base_units` varchar(78) NOT NULL,
	`recipient_count` int NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'DRAFT',
	`input_fingerprint` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `batches_id` PRIMARY KEY(`id`),
	CONSTRAINT `batches_public_batch_id_unique` UNIQUE(`public_batch_id`),
	CONSTRAINT `batches_public_id_idx` UNIQUE(`public_batch_id`)
);
--> statement-breakpoint
CREATE TABLE `chunks` (
	`id` varchar(36) NOT NULL,
	`batch_id` varchar(36) NOT NULL,
	`chunk_index` int NOT NULL,
	`recipient_count` int NOT NULL,
	`total_amount_base_units` varchar(78) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'DRAFT',
	`tx_hash` varchar(66),
	`block_number` bigint,
	`block_hash` varchar(66),
	`log_index` int,
	`relayer_nonce` int,
	`submitted_at` timestamp,
	`confirmed_at` timestamp,
	`reverted_at` timestamp,
	`error_code` varchar(64),
	`error_summary` text,
	CONSTRAINT `chunks_id` PRIMARY KEY(`id`),
	CONSTRAINT `chunks_batch_chunk_idx` UNIQUE(`batch_id`,`chunk_index`)
);
--> statement-breakpoint
CREATE TABLE `daily_stats` (
	`id` varchar(36) NOT NULL,
	`environment` varchar(32) NOT NULL,
	`date` varchar(10) NOT NULL,
	`wallet_address` varchar(42),
	`total_sent` varchar(78) NOT NULL DEFAULT '0',
	`total_recipients` int NOT NULL DEFAULT 0,
	`total_batches` int NOT NULL DEFAULT 0,
	`total_sponsored_recipients` int NOT NULL DEFAULT 0,
	`total_sponsorship_gas` varchar(78) NOT NULL DEFAULT '0',
	`total_donated` varchar(78) NOT NULL DEFAULT '0',
	CONSTRAINT `daily_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_stats_date_wallet_idx` UNIQUE(`environment`,`date`,`wallet_address`)
);
--> statement-breakpoint
CREATE TABLE `donations` (
	`id` varchar(36) NOT NULL,
	`environment` varchar(32) NOT NULL,
	`chain_id` int NOT NULL,
	`tx_hash` varchar(66) NOT NULL,
	`donor_address` varchar(42) NOT NULL,
	`amount_base_units` varchar(78) NOT NULL,
	`block_number` bigint NOT NULL,
	`block_hash` varchar(66),
	`log_index` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `donations_id` PRIMARY KEY(`id`),
	CONSTRAINT `donations_tx_log_idx` UNIQUE(`tx_hash`,`log_index`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` varchar(36) NOT NULL,
	`severity` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`resolved` boolean NOT NULL DEFAULT false,
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `presets` (
	`id` varchar(36) NOT NULL,
	`wallet_address` varchar(42) NOT NULL,
	`name` varchar(128) NOT NULL,
	`distribution_type` varchar(32) NOT NULL,
	`configuration_json` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reconciliation_checkpoints` (
	`id` varchar(36) NOT NULL,
	`worker_name` varchar(64) NOT NULL,
	`environment` varchar(32) NOT NULL,
	`last_block` bigint NOT NULL,
	`last_log_cursor` varchar(128),
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reconciliation_checkpoints_id` PRIMARY KEY(`id`),
	CONSTRAINT `reconciliation_worker_env_idx` UNIQUE(`worker_name`,`environment`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(36) NOT NULL,
	`wallet_address` varchar(42) NOT NULL,
	`session_token` varchar(128) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`revoked_at` timestamp,
	`session_version` int NOT NULL DEFAULT 1,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `sessions_session_token_unique` UNIQUE(`session_token`),
	CONSTRAINT `sessions_token_idx` UNIQUE(`session_token`)
);
--> statement-breakpoint
CREATE TABLE `sponsorship_ledger` (
	`id` varchar(36) NOT NULL,
	`wallet_address` varchar(42) NOT NULL,
	`batch_id` varchar(36),
	`chunk_id` varchar(36),
	`recipient_count` int NOT NULL,
	`estimated_gas` varchar(78),
	`actual_gas` varchar(78),
	`gas_cost_base_units` varchar(78),
	`status` varchar(32) NOT NULL,
	`month_key` varchar(10) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sponsorship_ledger_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `token_registry` (
	`id` varchar(36) NOT NULL,
	`environment` varchar(32) NOT NULL,
	`chain_id` int NOT NULL,
	`token_address` varchar(42) NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`decimals` int NOT NULL,
	`enabled` boolean NOT NULL DEFAULT true,
	`verified_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `token_registry_id` PRIMARY KEY(`id`),
	CONSTRAINT `token_env_addr_idx` UNIQUE(`environment`,`token_address`)
);
--> statement-breakpoint
CREATE TABLE `transaction_attempts` (
	`id` varchar(36) NOT NULL,
	`chunk_id` varchar(36) NOT NULL,
	`tx_hash` varchar(66) NOT NULL,
	`nonce` int NOT NULL,
	`gas_price_base_units` varchar(78),
	`status` varchar(32) NOT NULL DEFAULT 'SUBMITTED',
	`error_message` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transaction_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `tx_attempts_tx_hash_idx` UNIQUE(`tx_hash`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`wallet_address` varchar(42) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_wallet_address_unique` UNIQUE(`wallet_address`),
	CONSTRAINT `users_wallet_idx` UNIQUE(`wallet_address`)
);
--> statement-breakpoint
ALTER TABLE `batch_recipients` ADD CONSTRAINT `batch_recipients_batch_id_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `batch_recipients` ADD CONSTRAINT `batch_recipients_chunk_id_chunks_id_fk` FOREIGN KEY (`chunk_id`) REFERENCES `chunks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chunks` ADD CONSTRAINT `chunks_batch_id_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sponsorship_ledger` ADD CONSTRAINT `sponsorship_ledger_batch_id_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sponsorship_ledger` ADD CONSTRAINT `sponsorship_ledger_chunk_id_chunks_id_fk` FOREIGN KEY (`chunk_id`) REFERENCES `chunks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transaction_attempts` ADD CONSTRAINT `transaction_attempts_chunk_id_chunks_id_fk` FOREIGN KEY (`chunk_id`) REFERENCES `chunks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_admin_idx` ON `admin_audit_logs` (`admin_user_id`);--> statement-breakpoint
CREATE INDEX `audit_role_idx` ON `admin_audit_logs` (`role`);--> statement-breakpoint
CREATE INDEX `audit_created_idx` ON `admin_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `nonces_wallet_idx` ON `auth_nonces` (`wallet_address`);--> statement-breakpoint
CREATE INDEX `recipients_batch_idx` ON `batch_recipients` (`batch_id`);--> statement-breakpoint
CREATE INDEX `recipients_addr_idx` ON `batch_recipients` (`recipient_address`);--> statement-breakpoint
CREATE INDEX `batches_sender_idx` ON `batches` (`sender_wallet`);--> statement-breakpoint
CREATE INDEX `batches_idempotency_idx` ON `batches` (`sender_wallet`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `batches_fingerprint_idx` ON `batches` (`sender_wallet`,`input_fingerprint`);--> statement-breakpoint
CREATE INDEX `chunks_tx_hash_idx` ON `chunks` (`tx_hash`);--> statement-breakpoint
CREATE INDEX `donations_donor_idx` ON `donations` (`donor_address`);--> statement-breakpoint
CREATE INDEX `incidents_severity_idx` ON `incidents` (`severity`);--> statement-breakpoint
CREATE INDEX `incidents_resolved_idx` ON `incidents` (`resolved`);--> statement-breakpoint
CREATE INDEX `presets_wallet_idx` ON `presets` (`wallet_address`);--> statement-breakpoint
CREATE INDEX `sessions_wallet_idx` ON `sessions` (`wallet_address`);--> statement-breakpoint
CREATE INDEX `sponsorship_wallet_month_idx` ON `sponsorship_ledger` (`wallet_address`,`month_key`);--> statement-breakpoint
CREATE INDEX `tx_attempts_chunk_idx` ON `transaction_attempts` (`chunk_id`);