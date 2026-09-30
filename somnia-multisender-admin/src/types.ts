export type AdminRole = "SUPER_ADMIN" | "OPERATOR" | "FINANCE" | "SECURITY";

export interface BatchItem {
  id: string;
  publicBatchId: string;
  senderWallet: string;
  environment: string;
  chainId: number;
  tokenAddress: string | null;
  distributionType: string;
  totalAmountBaseUnits: string;
  recipientCount: number;
  status: "DRAFT" | "VALIDATED" | "SUBMITTED" | "PENDING" | "CONFIRMED" | "REVERTED" | "UNKNOWN" | "CANCELLED" | "PARTIAL";
  createdAt: string;
}

export interface ChunkItem {
  id: string;
  batchId: string;
  chunkIndex: number;
  recipientCount: number;
  totalAmountBaseUnits: string;
  status: string;
  txHash: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
  revertedAt: string | null;
  errorCode: string | null;
  errorSummary: string | null;
}

export interface AdminDashboardData {
  network?: {
    chainId: number;
    name: string;
    nativeSymbol: string;
  };
  activePendingCount: number;
  pendingChunks: ChunkItem[];
  gasPool: {
    poolAddress: string;
    onChainBalance: string;
    totalDonated: string;
    totalDonors: number;
    totalSponsoredRecipients: number;
    totalSponsorshipGasSpent: string;
    recentDonations: Array<{
      txHash: string;
      donor: string;
      amount: string;
      timestamp: string;
    }>;
  };
  relayer: {
    address: string;
    balanceEth: string;
  };
  stats: {
    activeBatches: number;
    totalBatchesTracked: number;
    revertedChunksCount: number;
    unknownChunksCount: number;
    sponsoredRecipientsToday: number;
    gasSpentTodayEth: string;
  };
  recentBatches: BatchItem[];
  recentChunks: ChunkItem[];
  incidents: Array<{
    id: string;
    category: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
    message: string;
    timestamp: string;
  }>;
  systemHealth: {
    api: string;
    database: string;
    rpc: string;
    indexer: string;
    relayer: string;
    sponsorship: string;
  };
}

export interface AuditLogItem {
  id: string;
  adminUserId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  beforeJson: string | null;
  afterJson: string | null;
  reason: string;
  ipAddress: string | null;
  createdAt: string;
}
