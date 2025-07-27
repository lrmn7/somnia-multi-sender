export const runtime = 'edge';

import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { contractAbi, contractAddress } from '../../lib/contract';
import { somniaTestnet } from '../../lib/backend-config'; 

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Method Not Allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const botPrivateKey = process.env.PRIVATE_KEY;
  if (!botPrivateKey) {
    return new Response(
      JSON.stringify({ success: false, message: 'Private key tidak dikonfigurasi di server' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { timestamp } = await req.json();
    if (!timestamp) {
      return new Response(
        JSON.stringify({ success: false, message: 'Timestamp dibutuhkan' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    const account = privateKeyToAccount(`0x${botPrivateKey}`);

    const walletClient = createWalletClient({
      account,
      chain: somniaTestnet,
      transport: http(somniaTestnet.rpcUrls.default.http[0]),
    });
    
    const publicClient = createPublicClient({
      chain: somniaTestnet,
      transport: http(somniaTestnet.rpcUrls.default.http[0]),
    });

    const hash = await walletClient.writeContract({
      address: contractAddress,
      abi: contractAbi,
      account: account,
      chain: somniaTestnet,
      functionName: 'logTimestamp',
      args: [timestamp],
      value: parseEther('0.001'),
    });

    await publicClient.waitForTransactionReceipt({ hash });

    return new Response(
      JSON.stringify({ success: true, message: 'Transaksi sukses', hash: hash }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error("[API EDGE] Transaksi Gagal:", err);
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Terjadi error di server' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}