import React, { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { DashboardView } from "./components/DashboardView";
import { TransactionsView } from "./components/TransactionsView";
import { GasPoolView } from "./components/GasPoolView";
import { IncidentsView } from "./components/IncidentsView";
import { AuditLogsView } from "./components/AuditLogsView";
import { HealthView } from "./components/HealthView";
import { SafetyModal } from "./components/SafetyModal";
import { AdminRole, AdminDashboardData } from "./types";
import { fetchDashboardData, triggerReconciliation } from "./api";
import { Toaster, toast } from "sonner";

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [role, setRole] = useState<AdminRole>("OPERATOR");
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);

  const loadData = async () => {
    const data = await fetchDashboardData();
    setDashboardData(data);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // Poll status every 15s
    return () => clearInterval(interval);
  }, []);

  const handleExecuteReconcile = async (reason: string) => {
    setIsReconciling(true);
    try {
      const res = await triggerReconciliation(reason, `${role.toLowerCase()}_agent`);
      toast.success(res.message);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger reconciliation");
    } finally {
      setIsReconciling(false);
    }
  };

  const incidentCount = dashboardData?.incidents?.length || 0;

  return (
    <div className="admin-layout">
      <Toaster theme="dark" position="top-right" richColors />

      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={role}
        setRole={setRole}
        onOpenReconcileModal={() => setIsReconcileModalOpen(true)}
        isReconciling={isReconciling}
        incidentCount={incidentCount}
      />

      <main className="admin-container">
        {activeTab === "dashboard" && (
          <DashboardView
            data={dashboardData}
            onNavigateTab={setActiveTab}
            onOpenReconcileModal={() => setIsReconcileModalOpen(true)}
          />
        )}

        {activeTab === "transactions" && (
          <TransactionsView
            role={role}
            onOpenReconcileModal={() => setIsReconcileModalOpen(true)}
          />
        )}

        {activeTab === "gas-pool" && (
          <GasPoolView
            data={dashboardData}
            role={role}
            onRefresh={loadData}
          />
        )}

        {activeTab === "incidents" && (
          <IncidentsView
            data={dashboardData}
            onOpenReconcileModal={() => setIsReconcileModalOpen(true)}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === "audit" && <AuditLogsView />}

        {activeTab === "health" && (
          <HealthView data={dashboardData} onRefresh={loadData} />
        )}
      </main>

      {/* High-assurance safety modal for manual reconciliation */}
      <SafetyModal
        isOpen={isReconcileModalOpen}
        onClose={() => setIsReconcileModalOpen(false)}
        onConfirm={handleExecuteReconcile}
        title="Execute Transaction Reconciliation Cycle"
        description="This will query the Somnia blockchain RPC for all PENDING and UNKNOWN chunk transactions, parse their EVM receipts, transition finalized states to CONFIRMED or REVERTED, and update gas accounting."
        requiredPhrase="RECONCILE"
        dangerLevel="high"
        confirmButtonText="Execute Reconciler"
      />
    </div>
  );
};

export default App;
