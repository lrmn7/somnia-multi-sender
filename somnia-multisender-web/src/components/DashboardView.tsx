import React, { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { fetchProfile, fetchHistory, BackendConfig } from "../services/api";

interface DashboardViewProps {
  userAddress?: string;
  config: BackendConfig;
  gasPoolMetrics: {
    onChainBalance: string;
    totalDonors: number;
  };
  onOpenGasPoolModal: () => void;
  onCreateDistribution: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  userAddress,
  config,
  gasPoolMetrics,
  onOpenGasPoolModal,
  onCreateDistribution,
}) => {
  const [period, setPeriod] = useState<"7D" | "30D" | "90D" | "ALL">("ALL");
  const [profileData, setProfileData] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);

  const nativeSymbol = config.chain?.nativeSymbol || "STT";
  const periods: Array<"7D" | "30D" | "90D" | "ALL"> = ["7D", "30D", "90D", "ALL"];

  useEffect(() => {
    if (userAddress) {
      setIsLoading(true);
      Promise.all([
        fetchProfile(userAddress, period),
        fetchHistory(userAddress),
      ])
        .then(([profileRes, historyRes]) => {
          setProfileData(profileRes);
          setBatches(historyRes?.batches || []);
        })
        .finally(() => setIsLoading(false));
    }
  }, [userAddress, period]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered batches
  const filteredBatches = batches.filter((b) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.publicBatchId?.toLowerCase().includes(q) ||
      b.distributionType?.toLowerCase().includes(q) ||
      b.status?.toLowerCase().includes(q)
    );
  });

  const displayedBatches = showAllHistory
    ? filteredBatches
    : filteredBatches.slice(0, 5);

  const metrics = profileData?.metrics;
  const quota = profileData?.quota;

  if (!userAddress) {
    return (
      <div className="dashboard-container">
        <div className="glass-card empty-wallet-card">
          <h2 className="empty-wallet-title">Connect Wallet</h2>
          <p className="empty-wallet-desc">
            Connect your Web3 wallet to access your personal Somnia Multisender activity, distribution analytics, and sponsored credits.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Subtle Back Navigation to Root Multisender */}
      <div className="dashboard-top-nav">
        <button
          type="button"
          onClick={onCreateDistribution}
          className="dashboard-back-link"
        >
          <span className="back-arrow-symbol">←</span>
          <span>Back to Multisender</span>
        </button>
      </div>

      {/* Dashboard Header */}
      <div className="dashboard-header-row">
        <div>
          <div className="account-identity">
            <span className="account-address mono">
              {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
            </span>
            <span className="account-badge">Connected</span>
          </div>
          <h1 className="dashboard-title">Personal Activity Hub</h1>
        </div>

        {/* Action: Create Distribution & Period Filter */}
        <div className="dashboard-actions-group">
          <div className="period-filter-group" role="group" aria-label="Time period filter">
            {periods.map((p) => (
              <button
                key={p}
                type="button"
                className={`period-btn ${period === p ? "active" : ""}`}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={onCreateDistribution}
          >
            New Distribution
          </button>
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="metrics-grid">
        {/* Sent */}
        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Outflow</span>
          </div>
          <div className="metric-value mono">
            {metrics?.totalSentBaseUnits
              ? (Number(metrics.totalSentBaseUnits) / 1e18).toFixed(2)
              : "0.00"}{" "}
            <span className="metric-unit">{nativeSymbol}</span>
          </div>
          <span className="metric-subtext">Total sent via Somnia Multisender</span>
        </div>

        {/* Received */}
        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-label">Total Inflow</span>
          </div>
          <div className="metric-value mono">
            {metrics?.totalReceivedBaseUnits
              ? (Number(metrics.totalReceivedBaseUnits) / 1e18).toFixed(2)
              : "0.00"}{" "}
            <span className="metric-unit">{nativeSymbol}</span>
          </div>
          <span className="metric-subtext">Received through this contract</span>
        </div>

        {/* Recipients */}
        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-label">Recipients Reached</span>
          </div>
          <div className="metric-value mono">
            {metrics?.totalRecipientsReached || 0}
          </div>
          <span className="metric-subtext">Unique recipient addresses</span>
        </div>

        {/* Batches */}
        <div className="glass-card metric-card">
          <div className="metric-header">
            <span className="metric-label">Batches Executed</span>
          </div>
          <div className="metric-value mono">
            {metrics?.totalBatchesExecuted || 0}
          </div>
          <span className="metric-subtext">Completed distribution batches</span>
        </div>
      </div>

      {/* Secondary Row: Gas Pool Card & Sponsorship Card */}
      <div className="dashboard-subgrid">
        {/* Community Gas Pool Ecosystem Card */}
        <div className="glass-card ecosystem-card">
          <div className="ecosystem-card-header">
            <h3 className="section-title">Community Gas Pool</h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onOpenGasPoolModal}
            >
              Donate Gas
            </button>
          </div>

          <p className="ecosystem-card-desc">
            Community-funded gas pool that subsidizes on-chain execution costs for eligible multisender users.
          </p>

          <div className="ecosystem-stats-row">
            <div className="ecosystem-stat">
              <span className="stat-label">On-Chain Balance</span>
              <span className="stat-val mono">
                {gasPoolMetrics.onChainBalance} {nativeSymbol}
              </span>
            </div>
            <div className="ecosystem-stat">
              <span className="stat-label">Community Donors</span>
              <span className="stat-val mono">{gasPoolMetrics.totalDonors}</span>
            </div>
            <div className="ecosystem-stat">
              <span className="stat-label">Your Contributions</span>
              <span className="stat-val mono">
                {metrics?.totalDonatedBaseUnits
                  ? (Number(metrics.totalDonatedBaseUnits) / 1e18).toFixed(2)
                  : "0.00"}{" "}
                {nativeSymbol}
              </span>
            </div>
          </div>
        </div>

        {/* Sponsorship Quota Status */}
        <div className="glass-card ecosystem-card">
          <div className="ecosystem-card-header">
            <h3 className="section-title">Monthly Free Sponsorship</h3>
            <span className="status-pill active">Active</span>
          </div>

          <p className="ecosystem-card-desc">
            Eligible distributions with up to 100 recipients receive sponsored network fees directly from the community gas pool.
          </p>

          <div className="ecosystem-stats-row">
            <div className="ecosystem-stat">
              <span className="stat-label">Remaining Credits</span>
              <span className="stat-val mono primary-emphasis">
                {quota?.remainingCredits ?? 100}{" "}
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                  / {quota?.totalAllowance ?? 100}
                </span>
              </span>
            </div>
            <div className="ecosystem-stat">
              <span className="stat-label">Current Billing Month</span>
              <span className="stat-val mono">
                {quota?.monthKey || "Current"}
              </span>
            </div>
            <div className="ecosystem-stat">
              <span className="stat-label">Status</span>
              <span className="stat-val" style={{ color: "var(--status-success)" }}>
                Eligible
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Activity / History Section */}
      <div className="glass-card history-card">
        <div className="history-header">
          <div>
            <h3 className="section-title">Recent Activity</h3>
            <p className="section-subtitle">
              On-chain batches executed through your wallet on Somnia.
            </p>
          </div>

          <div className="history-filter-row">
            <div className="search-box">
              <input
                type="text"
                placeholder="Filter by Batch ID or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>

        {displayedBatches.length === 0 ? (
          <div className="history-empty">
            <p>No distribution history found for this account.</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onCreateDistribution}
              style={{ marginTop: "12px" }}
            >
              Create First Distribution
            </button>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="glass-table">
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Recipients</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedBatches.map((b) => (
                    <tr key={b.id || b.publicBatchId}>
                      <td className="mono">
                        <div className="batch-id-cell">
                          <span>
                            {b.publicBatchId
                              ? `${b.publicBatchId.slice(0, 10)}...${b.publicBatchId.slice(-6)}`
                              : "—"}
                          </span>
                          {b.publicBatchId && (
                            <button
                              type="button"
                              className="copy-btn"
                              onClick={() => handleCopy(b.publicBatchId)}
                              aria-label="Copy batch ID"
                            >
                              {copiedId === b.publicBatchId ? (
                                <Check size={13} color="var(--status-success)" />
                              ) : (
                                <Copy size={13} />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        {b.createdAt
                          ? new Date(b.createdAt).toLocaleDateString()
                          : "—"}
                      </td>
                      <td style={{ textTransform: "capitalize" }}>
                        {b.distributionType || "Equal"}
                      </td>
                      <td className="mono">{b.recipientCount || 0}</td>
                      <td className="mono">
                        {b.totalAmountBaseUnits
                          ? (Number(b.totalAmountBaseUnits) / 1e18).toFixed(2)
                          : "0.00"}{" "}
                        {nativeSymbol}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            b.status === "CONFIRMED"
                              ? "badge-success"
                              : b.status === "REVERTED"
                              ? "badge-danger"
                              : "badge-neutral"
                          }`}
                        >
                          {b.status || "CONFIRMED"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredBatches.length > 5 && (
              <div className="history-footer">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowAllHistory(!showAllHistory)}
                >
                  {showAllHistory
                    ? "Show Less"
                    : `View All Activity (${filteredBatches.length} batches)`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
