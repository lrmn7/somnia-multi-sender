import React from "react";
import { AdminRole } from "../types";
import {
  LayoutDashboard,
  Receipt,
  Flame,
  AlertOctagon,
  FileText,
  Activity,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: AdminRole;
  setRole: (role: AdminRole) => void;
  onOpenReconcileModal: () => void;
  isReconciling: boolean;
  incidentCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  role,
  setRole,
  onOpenReconcileModal,
  isReconciling,
  incidentCount,
}) => {
  return (
    <header className="admin-nav">
      <div className="admin-brand">
        <span className="admin-logo-badge">SOMNIA OPS</span>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.2 }}>
          Multisender Control Center
        </span>
      </div>

      <nav className="admin-nav-tabs">
        <button
          className={`nav-tab ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          <LayoutDashboard size={15} />
          Dashboard
        </button>
        <button
          className={`nav-tab ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          <Receipt size={15} />
          Transactions
        </button>
        <button
          className={`nav-tab ${activeTab === "gas-pool" ? "active" : ""}`}
          onClick={() => setActiveTab("gas-pool")}
        >
          <Flame size={15} />
          Gas Pool
        </button>
        <button
          className={`nav-tab ${activeTab === "incidents" ? "active" : ""}`}
          onClick={() => setActiveTab("incidents")}
          style={{ position: "relative" }}
        >
          <AlertOctagon size={15} />
          Incidents
          {incidentCount > 0 && (
            <span
              style={{
                marginLeft: 4,
                padding: "1px 6px",
                borderRadius: 10,
                backgroundColor: "var(--status-error)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {incidentCount}
            </span>
          )}
        </button>
        <button
          className={`nav-tab ${activeTab === "audit" ? "active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
          <FileText size={15} />
          Audit Logs
        </button>
        <button
          className={`nav-tab ${activeTab === "health" ? "active" : ""}`}
          onClick={() => setActiveTab("health")}
        >
          <Activity size={15} />
          Health
        </button>
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {(role === "SUPER_ADMIN" || role === "OPERATOR") && (
          <button
            className="admin-btn admin-btn-secondary"
            style={{ padding: "6px 12px", fontSize: 12 }}
            onClick={onOpenReconcileModal}
            disabled={isReconciling}
          >
            <RefreshCw size={13} className={isReconciling ? "animate-spin" : ""} />
            Reconcile
          </button>
        )}

        <div className="admin-role-badge">
          <ShieldCheck size={14} style={{ color: "var(--text-secondary)" }} />
          <select
            className="role-select"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
          >
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="OPERATOR">Operator</option>
            <option value="FINANCE">Finance</option>
            <option value="SECURITY">Security</option>
          </select>
        </div>
      </div>
    </header>
  );
};
