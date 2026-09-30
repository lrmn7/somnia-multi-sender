import React, { useState, useEffect } from "react";
import { History as HistoryIcon, ExternalLink, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { fetchHistory, BackendConfig } from "../services/api";

interface HistoryViewProps {
  userAddress?: string;
  config: BackendConfig;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ userAddress, config }) => {
  const [batches, setBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (userAddress) {
      setIsLoading(true);
      fetchHistory(userAddress)
        .then((res) => setBatches(res?.batches || []))
        .finally(() => setIsLoading(false));
    }
  }, [userAddress]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!userAddress) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
        <HistoryIcon size={40} color="var(--text-muted)" style={{ margin: "0 auto 16px" }} />
        <h3>Connect Your Wallet</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "6px" }}>
          Please connect your wallet to view your batch execution history.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "24px" }}>
        <h2>Batch Execution History</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
          Immutable record of past distributions executed by your wallet on Somnia.
        </p>
      </div>

      <div className="card" style={{ padding: "0" }}>
        {batches.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--text-muted)" }}>
            <p>No batches found for this wallet yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Date</th>
                <th>Type</th>
                <th>Recipients</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{b.publicBatchId.slice(0, 16)}...</span>
                      <button
                        onClick={() => handleCopy(b.publicBatchId)}
                        style={{ color: "var(--text-muted)" }}
                      >
                        {copiedId === b.publicBatchId ? <Check size={14} color="var(--status-success)" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </td>
                  <td>{new Date(b.createdAt).toLocaleDateString()}</td>
                  <td style={{ textTransform: "capitalize" }}>{b.distributionType}</td>
                  <td>{b.recipientCount}</td>
                  <td>
                    {(Number(b.totalAmountBaseUnits) / 1e18).toFixed(2)} {config.chain.nativeSymbol}
                  </td>
                  <td>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        backgroundColor:
                          b.status === "CONFIRMED"
                            ? "var(--status-success-bg)"
                            : b.status === "REVERTED"
                            ? "var(--status-danger-bg)"
                            : "var(--bg-surface-elevated)",
                        color:
                          b.status === "CONFIRMED"
                            ? "var(--status-success)"
                            : b.status === "REVERTED"
                            ? "var(--status-danger)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
