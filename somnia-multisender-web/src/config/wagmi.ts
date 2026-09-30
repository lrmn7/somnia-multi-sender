import { getDefaultConfig, darkTheme } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";

export const somniaTestnet = defineChain({
  id: 50312,
  name: "Somnia Testnet",
  nativeCurrency: {
    name: "Shannon Test Token",
    symbol: "STT",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://dream-rpc.somnia.network"] },
  },
  blockExplorers: {
    default: { name: "Shannon Explorer", url: "https://shannon-explorer.somnia.network/" },
  },
  testnet: true,
});

export const somniaMainnet = defineChain({
  id: 5031,
  name: "Somnia",
  nativeCurrency: {
    name: "SOMI",
    symbol: "SOMI",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://api.infra.mainnet.somnia.network/"] },
  },
  blockExplorers: {
    default: { name: "Somnia Explorer", url: "https://explorer.somnia.network" },
  },
});

export const wagmiConfig = getDefaultConfig({
  appName: "Somnia Multisender",
  projectId: "4f738b4d1b702ec9f2c69d7a2283e39b", // Standard WalletConnect ID for dev/demo
  chains: [somniaTestnet],
  ssr: false,
});

export const customRainbowTheme = darkTheme({
  accentColor: "#262933",
  accentColorForeground: "#ffffff",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small",
});
