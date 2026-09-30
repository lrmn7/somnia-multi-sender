import React, { useState, useEffect } from "react";
import { BatchItem, ChunkItem, AdminRole } from "../types";
import { fetchTransactions } from "../api";
import { Search, Filter, ExternalLink, RefreshCw, X, AlertTriangle } from "lucide-react";

interface TransactionsViewProps {
  role: AdminRole;
  onOpenReconcileModal: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({ role, onOpenReconcileModal }) => {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchWallet, setSearchWallet] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<BatchItem | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchTransactions(statusFilter, searchWallet);
    setBatches(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  return (
    <div>
      <div className="panel-card">
        <div className="panel-header" style={{ flexWrap: "wrap", gap: 16 }}>
          <div className="panel-title">
            <span>Platform Transaction Batches</span>
            <span className="badge badge-neutral">{batches.length} Records</span>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: 12, color: "var(--text-muted)" }} />
                <input
                  type="text"
                  placeholder="Filter wallet 0x..."
                  className="input-field mono"
                  style={{ paddingLeft: 32, marginTop: 0, width: 220 }}
                  value={searchWallet}
                  onChange={(e) => setSearchWallet(e.target.value)}
                />
              </div>
              <button type="submit" className="admin-btn admin-btn-secondary" style={{ padding: "8px 12px" }}>
                Filter
              </button>
            </form>

            <select
              className="input-field"
              style={{ marginTop: 0, width: 140, cursor: "pointer" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REVERTED">Reverted</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Batch Public ID</th>
                <th>Sender Wallet</th>
                <th>Type</th>
                <th>Recipients</th>
                <th>Total Base Units</th>
                <th>Status</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
                    Loading transactions...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>
                    No matching transaction batches found.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{batch.publicBatchId}</td>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {batch.senderWallet.slice(0, 6)}...{batch.senderWallet.slice(-4)}
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{batch.distributionType}</td>
                    <td>{batch.recipientCount}</td>
                    <td className="mono" style={{ fontSize: 11 }}>
                      {batch.totalAmountBaseUnits.length > 18
                        ? (Number(batch.totalAmountBaseUnits) / 1e18).toFixed(4) + " SOMI"
                        : batch.totalAmountBaseUnits}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          batch.status === "CONFIRMED"
                            ? "badge-success"
                            : batch.status === "REVERTED" || batch.status === "UNKNOWN"
                            ? "badge-error"
                            : "badge-warning"
                        }`}
                      >
                        {batch.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {new Date(batch.createdAt).toLocaleString()}
                    </td>
                    <td>
                      <button
                        className="admin-btn admin-btn-secondary"
                        style={{ padding: "4px 10px", fontSize: 11 }}
                        onClick={() => setSelectedBatch(batch)}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Batch Detail Modal */}
      {selectedBatch && (
        <div className="modal-overlay" onClick={() => setSelectedBatch(null)}>
          <div className="modal-content" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <div className="modal-title" style={{ marginBottom: 4 }}>
                  Batch Inspection: {selectedBatch.publicBatchId}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Environment: <span className="mono" style={{ color: "var(--text-primary)" }}>{selectedBatch.environment}</span> (Chain ID {selectedBatch.chainId})
                </div>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20, fontSize: 13 }}>
              <div style={{ backgroundColor: "var(--bg-subtle)", padding: 12, borderRadius: 8 }}>
                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Sender Wallet</div>
                <div className="mono" style={{ marginTop: 2 }}>{selectedBatch.senderWallet}</div>
              </div>
              <div style={{ backgroundColor: "var(--bg-subtle)", padding: 12, borderRadius: 8 }}>
                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Asset Type</div>
                <div style={{ marginTop: 2 }}>
                  {selectedBatch.tokenAddress ? `ERC-20 (${selectedBatch.tokenAddress.slice(0, 10)}...)` : "Native Somnia (SOMI/STT)"}
                </div>
              </div>
              <div style={{ backgroundColor: "var(--bg-subtle)", padding: 12, borderRadius: 8 }}>
                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Distribution / Count</div>
                <div style={{ marginTop: 2, textTransform: "capitalize" }}>
                  {selectedBatch.distributionType} • {selectedBatch.recipientCount} Recipients
                </div>
              </div>
              <div style={{ backgroundColor: "var(--bg-subtle)", padding: 12, borderRadius: 8 }}>
                <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Batch Status</div>
                <div style={{ marginTop: 2 }}>
                  <span className={`badge ${selectedBatch.status === "CONFIRMED" ? "badge-success" : "badge-warning"}`}>
                    {selectedBatch.status}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                Execution Chunks Breakdown (Max 500 recipients / chunk)
              </div>
              <div style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-subtle)", borderRadius: 8, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <div>
                    <span className="mono" style={{ fontWeight: 600 }}>Chunk #1</span>: {selectedBatch.recipientCount} recipients
                  </div>
                  <span className={`badge ${selectedBatch.status === "CONFIRMED" ? "badge-success" : "badge-warning"}`}>
                    {selectedBatch.status}
                  </span>
                </div>
                <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-secondary)" }}>
                  Tx Hash: <span className="mono">0xa1b2c3d4e5f6...789abcdef</span>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <a
                href={`https://shannon-explorer.somnia.network/address/${selectedBatch.senderWallet}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--text-secondary)", fontSize: 12, display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}
              >
                Explorer View <ExternalLink size={12} />
              </a>

              {(role === "SUPER_ADMIN" || role === "OPERATOR") && (
                <button
                  className="admin-btn admin-btn-secondary"
                  onClick={() => {
                    setSelectedBatch(null);
                    onOpenReconcileModal();
                  }}
                >
                  <RefreshCw size={14} /> Reconcile This Batch
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
