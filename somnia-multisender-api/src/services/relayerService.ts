import { createWalletClient, createPublicClient, http, formatEther, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config/index.js";
import { db } from "../db/index.js";
import { chunks } from "../db/schema.js";
import { eq } from "drizzle-orm";

export const somniaChain = defineChain({
  id: config.network.chainId,
  name: config.network.name,
  nativeCurrency: {
    name: config.network.nativeSymbol,
    symbol: config.network.nativeSymbol,
    decimals: 18,
  },
  rpcUrls: {
    default: { http: [config.network.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "Explorer", url: config.network.explorerUrl },
  },
});

// Multisender ABI snippet for sendTokenSponsored
const MULTISENDER_ABI = [
  {
    name: "sendTokenSponsored",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sender", type: "address" },
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "totalAmount", type: "uint256" },
      { name: "batchId", type: "bytes32" },
      { name: "chunkIndex", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export class RelayerService {
  private account = privateKeyToAccount(config.relayerPrivateKey as `0x${string}`);

  private publicClient = createPublicClient({
    chain: somniaChain,
    transport: http(config.network.rpcUrl),
  });

  private walletClient = createWalletClient({
    account: this.account,
    chain: somniaChain,
    transport: http(config.network.rpcUrl),
  });

  public getRelayerAddress(): string {
    return this.account.address;
  }

  public async getBalance(): Promise<{ balanceEth: string; balanceWei: bigint }> {
    const bal = await this.publicClient.getBalance({ address: this.account.address });
    return {
      balanceEth: formatEther(bal),
      balanceWei: bal,
    };
  }

  public async submitSponsoredChunk(params: {
    senderAddress: string;
    tokenAddress: string;
    recipients: string[];
    amounts: string[];
    totalAmount: string;
    batchIdHex: `0x${string}`;
    chunkIndex: number;
    dbChunkId?: string;
  }): Promise<{ txHash: string; status: "SUBMITTED" | "FAILED" }> {
    const { senderAddress, tokenAddress, recipients, amounts, totalAmount, batchIdHex, chunkIndex, dbChunkId } = params;

    const multisenderAddress = config.network.multisenderAddress as `0x${string}`;

    try {
      const hash = await this.walletClient.writeContract({
        address: multisenderAddress,
        abi: MULTISENDER_ABI,
        functionName: "sendTokenSponsored",
        args: [
          senderAddress as `0x${string}`,
          tokenAddress as `0x${string}`,
          recipients.map((r) => r as `0x${string}`),
          amounts.map((a) => BigInt(a)),
          BigInt(totalAmount),
          batchIdHex,
          BigInt(chunkIndex),
        ],
      });

      if (dbChunkId) {
        await db
          .update(chunks)
          .set({
            status: "SUBMITTED",
            txHash: hash,
            submittedAt: new Date(),
          })
          .where(eq(chunks.id, dbChunkId as any));
      }

      return { txHash: hash, status: "SUBMITTED" };
    } catch (error: any) {
      console.error("[Relayer Error] Failed to submit sponsored transaction:", error);
      if (dbChunkId) {
        await db
          .update(chunks)
          .set({
            status: "REVERTED",
            errorCode: "SUBMISSION_ERROR",
            errorSummary: error?.message || String(error),
            revertedAt: new Date(),
          })
          .where(eq(chunks.id, dbChunkId as any));
      }
      throw error;
    }
  }
}

export const relayerService = new RelayerService();
