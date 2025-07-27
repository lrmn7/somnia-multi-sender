import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { WalletConnector } from '../components/WalletConnector';
import { contractAbi, contractAddress, explorerBaseUrl } from '../lib/contract';
import { somniaTestnet } from 'wagmi/chains';

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const { writeContract, data: hash, error: writeError, isPending } = useWriteContract();

  const { data: ownerAddress } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'owner',
  });

  const { data: contractBalance } = useBalance({
    address: contractAddress,
    chainId: somniaTestnet.id,
  });

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const isAdmin = isConnected && address?.toLowerCase() === ownerAddress?.toLowerCase();

  const handleWithdraw = async () => {
    if (!isAdmin) return;
    writeContract({
      address: contractAddress,
      abi: contractAbi,
      functionName: 'withdraw',
      chain: somniaTestnet,
      account: address,
    });
  };

  return (
    <>
      <Head>
        <title>Admin Panel - Time Logger</title>
      </Head>
      <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8">
        <div className="w-full max-w-md p-6 border-4 border-brand-orange shadow-pixel-orange bg-brand-dark">
          <Link href="/" className="text-brand-gray hover:underline mb-6 block">&larr; Back to Main App</Link>
          <h1 className="text-4xl text-center mb-6">Admin Panel</h1>

          <div className="flex justify-center my-8">
            <WalletConnector />
          </div>

          {isConnected && (
            <div className="text-center mt-6">
              {isAdmin ? (
                <div className="p-4 bg-green-900/50 border-2 border-green-500">
                  <h2 className="text-2xl text-green-400">Welcome, Admin!</h2>
                  <p className="text-brand-gray mb-2">Anda memiliki akses untuk menarik dana.</p>

                  <div className='my-4 p-2 bg-black/50 border border-brand-gray'>
                    <p className='text-brand-gray text-sm'>Saldo Kontrak Saat Ini</p>
                    <p className='text-2xl text-brand-orange'>
                      {contractBalance ? `${contractBalance.formatted} ${contractBalance.symbol}` : 'Loading...'}
                    </p>
                  </div>

                  <button
                    onClick={handleWithdraw}
                    disabled={isPending || isConfirming || contractBalance?.value === BigInt(0)} // PERBAIKAN 2 akan mengatasi error '0n' ini
                    className="mt-2 px-6 py-3 bg-brand-orange text-brand-dark rounded-md shadow-pixel-orange hover:bg-opacity-80 transition-all disabled:bg-gray-500 disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    {isPending ? 'Confirming...' : isConfirming ? 'Processing...' : 'Withdraw Funds'}
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-red-900/50 border-2 border-red-500">
                  <h2 className="text-2xl text-red-400">Access Denied</h2>
                  <p className="text-brand-gray">Hanya pemilik kontrak ({ownerAddress?.substring(0, 10)}...) yang dapat mengakses fungsi ini.</p>
                </div>
              )}
            </div>
          )}

          {hash && (
            <div className="mt-4 text-center">
              <p>Transaction sent! Hash:</p>
              <a href={`${explorerBaseUrl}${hash}`} target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline break-all">{hash}</a>
            </div>
          )}
          {isConfirmed && <p className="mt-2 text-center text-green-400">Withdrawal successful!</p>}
          {writeError && <p className="mt-2 text-center text-red-500">Error: {writeError.message}</p>}

        </div>
      </main>
    </>
  );
}