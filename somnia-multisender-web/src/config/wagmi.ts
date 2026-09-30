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
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "da05bbd5085d4953b1f21379473058f6",
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
