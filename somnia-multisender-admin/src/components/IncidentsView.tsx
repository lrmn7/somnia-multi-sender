import React from "react";
import { AdminDashboardData } from "../types";
import { AlertOctagon, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck } from "lucide-react";

interface IncidentsViewProps {
  data: AdminDashboardData | null;
  onOpenReconcileModal: () => void;
  onNavigateTab: (tab: string) => void;
}

export const IncidentsView: React.FC<IncidentsViewProps> = ({
  data,
  onOpenReconcileModal,
  onNavigateTab,
}) => {
  const incidents = data?.incidents || [];

  return (
    <div>
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <AlertOctagon size={18} />
            Platform Incident Response Center
          </div>
          <span className={`badge ${incidents.length === 0 ? "badge-success" : "badge-error"}`}>
            {incidents.length === 0 ? "ALL SYSTEMS STABLE" : `${incidents.length} ACTIVE INCIDENTS`}
          </span>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
          Real-time incident detection monitors Somnia RPC connection, relayer wallet gas levels, reconciliation timeout states, and gas pool reserve floors.
        </p>

        {incidents.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-secondary)" }}>
            <CheckCircle2 size={36} style={{ color: "#34d399", margin: "0 auto 12px", display: "block" }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Zero Active Incidents</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Relayer balance is nominal, Gas Pool reserve floor is intact, and no orphaned transactions exist.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {incidents.map((incident) => (
              <div
                key={incident.id}
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.05)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: 10,
                  padding: 20,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="badge badge-error">{incident.severity}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, textTransform: "uppercase", color: "var(--text-primary)" }}>
                      {incident.category}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {new Date(incident.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <div style={{ fontSize: 14, color: "var(--text-primary)", marginBottom: 14 }}>
                  {incident.message}
                </div>

                {/* Remediation Action */}
                <div style={{ display: "flex", gap: 10 }}>
                  {incident.category === "pending timeout" && (
                    <button className="admin-btn" style={{ fontSize: 12, padding: "6px 12px" }} onClick={onOpenReconcileModal}>
                      Trigger Reconciler Now
                    </button>
                  )}
                  {incident.category === "gas pool low" && (
                    <button className="admin-btn admin-btn-secondary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => onNavigateTab("gas-pool")}>
                      Review Gas Pool Reserves
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Standard Incident Runbook */}
      <div className="panel-card">
        <div className="panel-title" style={{ marginBottom: 16 }}>
          Standard Operational Runbooks (PRD Incident Guide)
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ backgroundColor: "var(--bg-subtle)", padding: 16, borderRadius: 8, fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
              Runbook 1: Relayer Low Balance Alert
            </div>
            <ol style={{ paddingLeft: 18, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              <li>Identify current relayer address and query balance on Somnia explorer.</li>
              <li>Execute on-chain `claimReimbursement` from GasPool contract to replenish gas.</li>
              <li>If GasPool balance is also low, pause sponsorship until community donations arrive.</li>
            </ol>
          </div>

          <div style={{ backgroundColor: "var(--bg-subtle)", padding: 16, borderRadius: 8, fontSize: 12 }}>
            <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
              Runbook 2: Stuck UNKNOWN Status Chunks
            </div>
            <ol style={{ paddingLeft: 18, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              <li><strong>Do not blind-retry!</strong> Blind retries risk double-spending recipient payouts.</li>
              <li>Trigger manual Reconcile to fetch transaction receipts from Somnia RPC.</li>
              <li>If receipt confirms execution, reconciler moves chunk to CONFIRMED.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
