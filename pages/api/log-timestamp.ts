export const runtime = 'edge';
import type { NextApiRequest, NextApiResponse } from 'next';
import { ethers } from 'ethers';
import { contractAbi, contractAddress } from '../../lib/contract';
import { somniaTestnet } from 'wagmi/chains';

type ApiResponse = {
  success: boolean;
  message: string;
  hash?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const botPrivateKey = process.env.PRIVATE_KEY;

  if (!botPrivateKey) {
    return res.status(500).json({ success: false, message: 'Private key tidak dikonfigurasi di server' });
  }
  
  const { timestamp } = req.body;
  if (!timestamp) {
    return res.status(400).json({ success: false, message: 'Timestamp dibutuhkan' });
  }

  try {
    const provider = new ethers.JsonRpcProvider(somniaTestnet.rpcUrls.default.http[0]);
    const wallet = new ethers.Wallet(botPrivateKey, provider);
    const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

    console.log(`[API] Mengirim transaksi dengan timestamp: ${timestamp}`);
    const tx = await contract.logTimestamp(timestamp, { value: ethers.parseEther("0.001") });
    await tx.wait();

    res.status(200).json({ success: true, message: 'Transaksi sukses', hash: tx.hash });

  } catch (err: any) {
    console.error("[API] Transaksi Gagal:", err);
    res.status(500).json({ success: false, message: err.reason || 'Terjadi error di server' });
  }
}