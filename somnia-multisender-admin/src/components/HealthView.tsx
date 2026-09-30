import React from "react";
import { AdminDashboardData } from "../types";
import { Activity, CheckCircle2, AlertTriangle, ShieldCheck, Server, Database, Radio, RefreshCw } from "lucide-react";

interface HealthViewProps {
  data: AdminDashboardData | null;
  onRefresh: () => void;
}

export const HealthView: React.FC<HealthViewProps> = ({ data, onRefresh }) => {
  const health = data?.systemHealth || {
    api: "HEALTHY",
    database: "HEALTHY",
    rpc: "HEALTHY",
    indexer: "HEALTHY",
    relayer: "HEALTHY",
    sponsorship: "ACTIVE",
  };

  const dependencies = [
    {
      name: "API Gateway (Hono / Node.js)",
      status: health.api,
      icon: Server,
      desc: "Handles transaction ingest, quota management, and client queries",
      endpoint: "/v1/health",
    },
    {
      name: "PostgreSQL Database",
      status: health.database,
      icon: Database,
      desc: "Persistent store for batches, chunks, recipients, and audit logs",
      endpoint: "Port 5432 (Pool active)",
    },
    {
      name: "Somnia Shannon RPC Node",
      status: health.rpc,
      icon: Radio,
      desc: "JSON-RPC endpoint for chain queries, state read, and tx broadcasting",
      endpoint: "https://api.infra.testnet.somnia.network",
    },
    {
      name: "Transaction Indexer Worker",
      status: health.indexer,
      icon: RefreshCw,
      desc: "Checkpointed worker listening to Multisender.sol BatchExecuted events",
      endpoint: "Internal Worker (10s poll cycle)",
    },
    {
      name: "Autonomous Gas Relayer",
      status: health.relayer,
      icon: ShieldCheck,
      desc: "Wallet submitting sponsored chunks with non-blocking nonce queue",
      endpoint: data ? `${data.relayer.address.slice(0, 10)}... (${parseFloat(data.relayer.balanceEth).toFixed(2)} SOMI)` : "-",
    },
    {
      name: "Sponsorship Protocol",
      status: health.sponsorship,
      icon: Activity,
      desc: "Community Gas Pool subsidized transfers for eligible users",
      endpoint: health.sponsorship === "ACTIVE" ? "Serving 100 rec/month quota" : "Paused by Administrator",
    },
  ];

  return (
    <div>
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <Activity size={18} />
            System Dependency & Infrastructure Health
          </div>
          <button className="admin-btn admin-btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={onRefresh}>
            <RefreshCw size={13} /> Ping Dependencies
          </button>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>
          Live diagnostic status of all backend microservices, RPC endpoints, and on-chain relayer nodes.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {dependencies.map((dep, idx) => {
            const Icon = dep.icon;
            const isGood = dep.status === "HEALTHY" || dep.status === "ACTIVE";
            return (
              <div
                key={idx}
                style={{
                  backgroundColor: "var(--bg-subtle)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 10,
                  padding: 18,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon size={18} style={{ color: "var(--text-secondary)" }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{dep.name}</span>
                  </div>
                  <span className={`badge ${isGood ? "badge-success" : "badge-error"}`}>
                    {dep.status}
                  </span>
                </div>

                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
                  {dep.desc}
                </div>

                <div className="mono" style={{ fontSize: 11, color: "var(--text-muted)", backgroundColor: "var(--bg-primary)", padding: "6px 10px", borderRadius: 4 }}>
                  {dep.endpoint}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
