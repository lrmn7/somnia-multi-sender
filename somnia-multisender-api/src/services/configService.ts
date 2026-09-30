import { config } from "../config/index.js";

export interface PublicTokenInfo {
  address: string;
  symbol: string;
  decimals: number;
}

// Allowlisted tokens on Somnia Mainnet and Testnet
const ALLOWLISTED_TOKENS: Record<string, PublicTokenInfo[]> = {
  mainnet: [
    { address: "0x046EDe9564A72571df6F5e44d0405360c0f4dCab", symbol: "WSOMI", decimals: 18 },
    { address: "0x28BEc7E30E6faee657a03e19Bf1128AaD7632A00", symbol: "USDC", decimals: 6 },
    { address: "0x67B302E35Aef5EEE8c32D934F5856869EF428330", symbol: "USDT", decimals: 6 },
    { address: "0x936Ab8C674bcb567CD5dEB85D8A216494704E9D8", symbol: "WETH", decimals: 18 },
    { address: "0xC5098b3cA516784323872F17235fa074E167D3D2", symbol: "WBTC", decimals: 8 },
  ],
  testnet: [
    { address: "0x6907c9b269ccd17a307ffa0e275c5cd4fed2486b", symbol: "STMT", decimals: 18 },
    { address: "0x0000000000000000000000000000000000000001", symbol: "WSTT", decimals: 18 },
  ],
};

export function getPublicConfig() {
  const currentTokens = ALLOWLISTED_TOKENS[config.environment] || [];

  return {
    environment: config.environment,
    chain: {
      id: config.network.chainId,
      name: config.network.name,
      nativeSymbol: config.network.nativeSymbol,
      rpcUrl: config.network.rpcUrl,
    },
    explorer: config.network.explorerUrl,
    contracts: {
      multisender: config.network.multisenderAddress,
      gasPool: config.network.gasPoolAddress,
    },
    tokens: currentTokens,
    limits: {
      maxRecipientsPerBatch: config.limits.maxBatchRecipients,
      maxRecipientsPerChunk: config.limits.maxRecipientsPerChunk,
      hardMaxRecipientsPerChunk: config.limits.hardMaxRecipientsPerChunk,
      configuredSafeGasLimit: config.limits.configuredSafeGasLimit.toString(),
      gasSafetyMarginPercent: config.limits.gasSafetyMarginPercent,
      defaultMonthlySponsoredRecipientCredits: config.limits.monthlySponsoredCredits,
    },
  };
}
