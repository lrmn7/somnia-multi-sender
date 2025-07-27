// lib/backend-config.ts
import { defineChain } from 'viem';

// Definisikan chain Somnia Testnet di sini.
// Kode ini "ramping" dan aman untuk diimpor di backend.
export const somniaTestnet = defineChain({
  id: 50312,
  name: 'Somnia Testnet',
  nativeCurrency: { name: 'Somnia Testnet', symbol: 'STT', decimals: 18 },
  rpcUrls: {
    default: {
      http: ['https://dream-rpc.somnia.network'],
    },
  },
  blockExplorers: {
    default: { name: 'Shannon Explorer', url: 'https://shannon-explorer.somnia.network/' },
  },
  testnet: true,
})