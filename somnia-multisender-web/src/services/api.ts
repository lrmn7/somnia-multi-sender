const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://localhost:3001/v1";

export interface BackendConfig {
  environment: "testnet" | "mainnet";
  chain: {
    id: number;
    name: string;
    nativeSymbol: string;
    rpcUrl: string;
  };
  explorer: string;
  contracts: {
    multisender: string;
    gasPool: string;
  };
  tokens: Array<{ address: string; symbol: string; decimals: number }>;
  limits: {
    maxRecipientsPerBatch: number;
    maxRecipientsPerChunk: number;
    defaultMonthlySponsoredRecipientCredits: number;
  };
}

export const fallbackConfig: BackendConfig = {
  environment: "testnet",
  chain: {
    id: 50312,
    name: "Somnia Testnet (Shannon)",
    nativeSymbol: "STT",
    rpcUrl: "https://dream-rpc.somnia.network",
  },
  explorer: "https://shannon-explorer.somnia.network/",
  contracts: {
    multisender: "0x0d7504a6004064e4dd48ac88d8d3ba75b38dc8d0",
    gasPool: "0x89468c50ef19537abd15f497c1aa6414c0d92809",
  },
  tokens: [
    { address: "0x0000000000000000000000000000000000000001", symbol: "WSTT", decimals: 18 },
  ],
  limits: {
    maxRecipientsPerBatch: 2500,
    maxRecipientsPerChunk: 500,
    defaultMonthlySponsoredRecipientCredits: 100,
  },
};

export async function fetchRuntimeConfig(): Promise<BackendConfig> {
  try {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw new Error("Failed to fetch runtime config");
    return await res.json();
  } catch (e) {
    console.warn("Backend API unavailable, using resilient fallback configuration");
    return fallbackConfig;
  }
}

export async function fetchGasPoolMetrics() {
  try {
    const res = await fetch(`${API_BASE}/gas-pool`);
    if (!res.ok) throw new Error("Failed to fetch gas pool");
    return await res.json();
  } catch (e) {
    return {
      poolAddress: "0x...",
      onChainBalance: "0.0",
      totalDonated: "0",
      totalDonors: 0,
      totalSponsoredRecipients: 0,
      totalSponsorshipGasSpent: "0",
      recentDonations: [],
    };
  }
}

export async function fetchProfile(wallet: string, period = "ALL") {
  try {
    const res = await fetch(`${API_BASE}/profile/${wallet}?period=${period}`);
    if (!res.ok) throw new Error("Failed to fetch profile");
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function fetchHistory(wallet: string) {
  try {
    const res = await fetch(`${API_BASE}/profile/history/${wallet}`);
    if (!res.ok) throw new Error("Failed to fetch history");
    return await res.json();
  } catch (e) {
    return { batches: [] };
  }
}

export async function requestSponsorQuote(walletAddress: string, recipientCount: number, tokenAddress: string) {
  const res = await fetch(`${API_BASE}/sponsor/quote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress, recipientCount, tokenAddress }),
  });
  return await res.json();
}
