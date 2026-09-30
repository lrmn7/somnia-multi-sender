import React from "react";
import { AdminDashboardData } from "../types";
import {
  Layers,
  Clock,
  HelpCircle,
  AlertCircle,
  Users,
  Coins,
  Fuel,
  Wallet,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";

interface DashboardViewProps {
  data: AdminDashboardData | null;
  onNavigateTab: (tab: string) => void;
  onOpenReconcileModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  onNavigateTab,
  onOpenReconcileModal,
}) => {
  if (!data) return <div style={{ color: "var(--text-secondary)" }}>Loading dashboard metrics...</div>;

  return (
    <div>
      {/* Incident Quick Alert Banner if active */}
      {data.incidents && data.incidents.length > 0 && (
        <div className="alert-banner alert-banner-danger" style={{ cursor: "pointer" }} onClick={() => onNavigateTab("incidents")}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <strong>{data.incidents.length} Active System Incident(s) Detected:</strong>
            <span style={{ marginLeft: 6 }}>{data.incidents[0].message}</span>
          </div>
          <button className="admin-btn admin-btn-secondary" style={{ padding: "4px 8px", fontSize: 11 }}>
            View Runbook
          </button>
        </div>
      )}

      {/* Top Metric Cards Grid */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-title">
            <span>Active Batches</span>
            <Layers size={15} />
          </div>
          <div className="stat-card-val">{data.stats.activeBatches}</div>
          <div className="stat-card-sub">{data.stats.totalBatchesTracked} total tracked</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">
            <span>Pending Transactions</span>
            <Clock size={15} />
          </div>
          <div className="stat-card-val" style={{ color: data.activePendingCount > 0 ? "var(--status-warning)" : "inherit" }}>
            {data.activePendingCount}
          </div>
          <div className="stat-card-sub">In mempool / submitting</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">
            <span>Unknown Status Txs</span>
            <HelpCircle size={15} />
          </div>
          <div className="stat-card-val" style={{ color: data.stats.unknownChunksCount > 0 ? "var(--status-error)" : "inherit" }}>
            {data.stats.unknownChunksCount}
          </div>
          <div className="stat-card-sub">Requires reconciliation</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">
            <span>Reverted Chunks</span>
            <AlertCircle size={15} />
          </div>
          <div className="stat-card-val">{data.stats.revertedChunksCount}</div>
          <div className="stat-card-sub">Failed on-chain execution</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">
            <span>Sponsored Today</span>
            <Users size={15} />
          </div>
          <div className="stat-card-val">{data.stats.sponsoredRecipientsToday}</div>
          <div className="stat-card-sub">Recipients subsidized</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">
            <span>Gas Spent Today</span>
            <Coins size={15} />
          </div>
          <div className="stat-card-val mono">{data.stats.gasSpentTodayEth} SOMI</div>
          <div className="stat-card-sub">Platform relayer cost</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">
            <span>Gas Pool Reserve</span>
            <Fuel size={15} />
          </div>
          <div className="stat-card-val mono">{parseFloat(data.gasPool.onChainBalance).toFixed(2)} SOMI</div>
          <div className="stat-card-sub">{data.gasPool.totalDonors} community donors</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">
            <span>Relayer Balance</span>
            <Wallet size={15} />
          </div>
          <div className="stat-card-val mono" style={{ color: parseFloat(data.relayer.balanceEth) < 2 ? "var(--status-warning)" : "inherit" }}>
            {parseFloat(data.relayer.balanceEth).toFixed(2)} SOMI
          </div>
          <div className="stat-card-sub">{data.relayer.address.slice(0, 8)}...{data.relayer.address.slice(-6)}</div>
        </div>
      </div>

      {/* Main operational panels */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
        {/* Active / Recent Chunks table */}
        <div className="panel-card" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <div className="panel-title">
              <Clock size={16} />
              Active & Pending Chunks
            </div>
            <button className="admin-btn admin-btn-secondary" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => onNavigateTab("transactions")}>
              View All Batches <ArrowUpRight size={13} />
            </button>
          </div>

          {data.pendingChunks.length === 0 ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              All transactions reconciled. No pending or stuck chunks.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Batch ID</th>
                    <th>Chunk</th>
                    <th>Recipients</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Tx Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingChunks.map((ch) => (
                    <tr key={ch.id}>
                      <td className="mono" style={{ fontSize: 12 }}>{ch.batchId}</td>
                      <td>#{ch.chunkIndex + 1}</td>
                      <td>{ch.recipientCount}</td>
                      <td>
                        <span className={`badge ${ch.status === "CONFIRMED" ? "badge-success" : ch.status === "REVERTED" ? "badge-error" : "badge-warning"}`}>
                          {ch.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {ch.submittedAt ? new Date(ch.submittedAt).toLocaleTimeString() : "-"}
                      </td>
                      <td>
                        {ch.txHash ? (
                          <a
                            href={`https://shannon-explorer.somnia.network/tx/${ch.txHash}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}
                            className="mono"
                          >
                            {ch.txHash.slice(0, 6)}...{ch.txHash.slice(-4)}
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Operations & System Status */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="panel-card" style={{ marginBottom: 0 }}>
            <div className="panel-title" style={{ marginBottom: 16 }}>
              Quick Operator Actions
            </div>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              Perform safe operational tasks. All executions are strictly audited.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="admin-btn admin-btn-secondary" style={{ justifyContent: "space-between" }} onClick={onOpenReconcileModal}>
                <span>Run Transaction Reconciliation Cycle</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>FSM Sync</span>
              </button>
              <button className="admin-btn admin-btn-secondary" style={{ justifyContent: "space-between" }} onClick={() => onNavigateTab("gas-pool")}>
                <span>Inspect Gas Pool & Community Reserves</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Gas Policy</span>
              </button>
              <button className="admin-btn admin-btn-secondary" style={{ justifyContent: "space-between" }} onClick={() => onNavigateTab("audit")}>
                <span>Inspect Operational Audit Logs</span>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>Logs</span>
              </button>
            </div>
          </div>

          <div className="panel-card" style={{ marginBottom: 0 }}>
            <div className="panel-title" style={{ marginBottom: 16 }}>
              System Health Overview
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.entries(data.systemHealth).map(([service, status]) => (
                <div key={service} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <span style={{ textTransform: "capitalize", color: "var(--text-secondary)" }}>{service}</span>
                  <span className={`badge ${status === "HEALTHY" || status === "ACTIVE" ? "badge-success" : status === "DEGRADED" ? "badge-warning" : "badge-error"}`}>
                    {status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
