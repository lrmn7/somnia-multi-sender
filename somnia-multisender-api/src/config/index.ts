import * as dotenv from "dotenv";
import { createPublicClient, http } from "viem";

dotenv.config();

export type SomniaEnvironment = "mainnet" | "testnet";

export interface NetworkConfig {
  chainId: number;
  name: string;
  nativeSymbol: string;
  rpcUrl: string;
  explorerUrl: string;
  multisenderAddress: string;
  gasPoolAddress: string;
}

const env: SomniaEnvironment = (process.env.SOMNIA_ENV as SomniaEnvironment) === "mainnet" ? "mainnet" : "testnet";

const networkDefaults: Record<SomniaEnvironment, NetworkConfig> = {
  mainnet: {
    chainId: 5031,
    name: "Somnia",
    nativeSymbol: "SOMI",
    rpcUrl: process.env.SOMNIA_MAINNET_RPC_URL || "https://api.infra.mainnet.somnia.network/",
    explorerUrl: process.env.MAINNET_EXPLORER_URL || "https://explorer.somnia.network",
    multisenderAddress: process.env.MULTISENDER_MAINNET_ADDRESS || "",
    gasPoolAddress: process.env.GAS_POOL_MAINNET_ADDRESS || "",
  },
  testnet: {
    chainId: 50312,
    name: "Somnia Testnet (Shannon)",
    nativeSymbol: "STT",
    rpcUrl: process.env.SOMNIA_TESTNET_RPC_URL || "https://dream-rpc.somnia.network",
    explorerUrl: process.env.TESTNET_EXPLORER_URL || "https://shannon-explorer.somnia.network/",
    multisenderAddress: process.env.MULTISENDER_TESTNET_ADDRESS || "0x0000000000000000000000000000000000000000",
    gasPoolAddress: process.env.GAS_POOL_TESTNET_ADDRESS || "0x0000000000000000000000000000000000000000",
  },
};

export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  environment: env,
  network: networkDefaults[env],
  databaseUrl: process.env.DATABASE_URL || "mysql://root:password@localhost:3306/somnia_multisender",
  relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001",
  corsOrigins: [
    process.env.PUBLIC_APP_ORIGIN || "http://localhost:5173",
    process.env.ADMIN_APP_ORIGIN || "http://localhost:5174",
  ],
  limits: {
    monthlySponsoredCredits: parseInt(process.env.MONTHLY_SPONSORED_RECIPIENT_CREDITS || "100", 10),
    maxRecipientsPerChunk: parseInt(process.env.MAX_RECIPIENTS_PER_CHUNK || "500", 10),
    hardMaxRecipientsPerChunk: parseInt(process.env.MAX_RECIPIENTS_PER_CHUNK || "500", 10),
    maxBatchRecipients: parseInt(process.env.MAX_BATCH_RECIPIENTS || "2500", 10),
    configuredSafeGasLimit: BigInt(process.env.CONFIGURED_SAFE_GAS_LIMIT || "50000000"), // 50M gas safe execution budget
    gasSafetyMarginPercent: parseInt(process.env.GAS_SAFETY_MARGIN_PERCENT || "20", 10), // 20% configurable safety margin
    sponsorshipDailySomiCap: process.env.SPONSORSHIP_DAILY_SOMI_CAP || "500",
    sponsorshipHourlySomiCap: process.env.SPONSORSHIP_HOURLY_SOMI_CAP || "50",
  },
  auth: {
    nonceTtlSeconds: parseInt(process.env.AUTH_NONCE_TTL_SECONDS || "300", 10),
    sessionSecret: process.env.SESSION_SECRET || "dev_secret_key_somnia_multisender_2026",
  },
};

/**
 * Validates connection to the configured Somnia RPC node, contracts, and MySQL at startup.
 * FAILS CLOSED if chain ID or critical configurations are invalid.
 */
export async function validateChainStartup(): Promise<void> {
  const publicClient = createPublicClient({
    transport: http(config.network.rpcUrl, {
      timeout: 10_000,
    }),
  });

  let remoteChainId: number;
  try {
    remoteChainId = await publicClient.getChainId();
  } catch (err) {
    if (config.nodeEnv === "test") {
      console.warn(`[WARN] RPC unreachable in test environment: ${err instanceof Error ? err.message : String(err)}. Continuing.`);
      return;
    }
    const connectErr = `[FATAL] Unable to connect to Somnia RPC (${config.network.rpcUrl}): ${err instanceof Error ? err.message : String(err)}`;
    console.error(connectErr);
    throw new Error(connectErr);
  }

  // Network Safety Check: Chain ID MUST match expected
  if (remoteChainId !== config.network.chainId) {
    const errorMsg = `FATAL NETWORK MISMATCH: Expected chain ID ${config.network.chainId} (${config.environment} - ${config.network.name}), but received chain ID ${remoteChainId}. Aborting startup.`;
    console.error(`[CRITICAL FATAL] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  // Contract verification on-chain
  if (config.nodeEnv !== "test") {
    const msAddr = config.network.multisenderAddress as `0x${string}`;
    const gpAddr = config.network.gasPoolAddress as `0x${string}`;

    if (!msAddr || msAddr === "0x0000000000000000000000000000000000000000") {
      throw new Error(`[FATAL] Missing or zero address for Multisender in ${config.environment}`);
    }
    if (!gpAddr || gpAddr === "0x0000000000000000000000000000000000000000") {
      throw new Error(`[FATAL] Missing or zero address for GasPool in ${config.environment}`);
    }

    const msCode = await publicClient.getBytecode({ address: msAddr });
    if (!msCode || msCode === "0x") {
      throw new Error(`[FATAL] Multisender contract at ${msAddr} has no deployed bytecode on chain ${remoteChainId}`);
    }

    const gpCode = await publicClient.getBytecode({ address: gpAddr });
    if (!gpCode || gpCode === "0x") {
      throw new Error(`[FATAL] GasPool contract at ${gpAddr} has no deployed bytecode on chain ${remoteChainId}`);
    }

    console.log(`[OK] On-chain contracts verified: Multisender (${msAddr}), GasPool (${gpAddr})`);
  }

  console.log(`[OK] Network Safety Check Passed: Connected to ${config.network.name} (Chain ID: ${remoteChainId}) via ${config.network.rpcUrl}`);
}
