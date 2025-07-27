import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '../lib/wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../styles/globals.css'
import type { AppProps } from 'next/app'

const queryClient = new QueryClient()

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Component {...pageProps} />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
