import { http, createConfig } from 'wagmi';
import { somniaTestnet } from 'wagmi/chains';

export const config = createConfig({
  chains: [somniaTestnet],
  transports: {
    [somniaTestnet.id]: http(),
  },
  ssr: true,
});