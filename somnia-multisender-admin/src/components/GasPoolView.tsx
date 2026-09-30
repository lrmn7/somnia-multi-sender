import React, { useState } from "react";
import { AdminDashboardData, AdminRole } from "../types";
import { toggleSponsorship } from "../api";
import { SafetyModal } from "./SafetyModal";
import { toast } from "sonner";
import {
  Flame,
  ShieldAlert,
  Users,
  Coins,
  ArrowDownLeft,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  Info,
} from "lucide-react";

interface GasPoolViewProps {
  data: AdminDashboardData | null;
  role: AdminRole;
  onRefresh: () => void;
}

export const GasPoolView: React.FC<GasPoolViewProps> = ({ data, role, onRefresh }) => {
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [targetPauseState, setTargetPauseState] = useState(false);

  if (!data) return <div>Loading gas pool data...</div>;

  const isPaused = data.systemHealth.sponsorship === "PAUSED";
  const canModifySponsorship = role === "SUPER_ADMIN" || role === "SECURITY";

  const handleOpenSafetyModal = (pause: boolean) => {
    setTargetPauseState(pause);
    setIsSafetyModalOpen(true);
  };

  const handleExecuteToggle = async (reason: string) => {
    try {
      const res = await toggleSponsorship(targetPauseState, reason, `${role.toLowerCase()}_agent`);
      toast.success(res.message);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update sponsorship policy");
    }
  };

  // Safe projection calculation
  const currentReserve = parseFloat(data.gasPool.onChainBalance);
  const dailySpend = parseFloat(data.stats.gasSpentTodayEth) || 0.5;
  const projectedDaysRemaining = dailySpend > 0 ? (currentReserve / dailySpend).toFixed(1) : "N/A";
  const tokenSymbol = data.network?.nativeSymbol || (data.network?.chainId === 50312 ? "STT" : "SOMI");

  return (
    <div>
      {/* Top Banner Alert regarding Treasury safety rule */}
      <div className="alert-banner alert-banner-warning">
        <Info size={18} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Strict Non-Custodial Protocol:</strong> The community GasPool contract is immutable and contains no arbitrary owner withdrawal functions. Funds in the pool can only be claimed by authorized relayer addresses as a bounded deterministic sponsorship credit (subject to per-chunk caps, daily caps, and reserve floor) for confirmed on-chain chunk execution.
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-card-title">
            <span>On-Chain Reserve</span>
            <Flame size={15} />
          </div>
          <div className="stat-card-val mono">{parseFloat(data.gasPool.onChainBalance).toFixed(2)} {tokenSymbol}</div>
          <div className="stat-card-sub">Reserve floor: 10.00 {tokenSymbol}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">
            <span>Total Donated</span>
            <ArrowDownLeft size={15} />
          </div>
          <div className="stat-card-val mono">{parseFloat(data.gasPool.totalDonated).toFixed(2)} {tokenSymbol}</div>
          <div className="stat-card-sub">Lifetime community gifts</div>
        </div>


        <div className="stat-card">
          <div className="stat-card-title">
            <span>Unique Donors</span>
            <Users size={15} />
          </div>
          <div className="stat-card-val">{data.gasPool.totalDonors}</div>
          <div className="stat-card-sub">Community contributors</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-title">
            <span>Projected Runway</span>
            <Coins size={15} />
          </div>
          <div className="stat-card-val mono">{projectedDaysRemaining} Days</div>
          <div className="stat-card-sub">Based on current daily burn</div>
        </div>
      </div>

      {/* Governance & Policy Panel */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 24, marginBottom: 24 }}>
        <div className="panel-card" style={{ marginBottom: 0 }}>
          <div className="panel-header">
            <div className="panel-title">
              <ShieldAlert size={16} />
              Sponsorship Emergency Policy
            </div>
            <span className={`badge ${isPaused ? "badge-error" : "badge-success"}`}>
              {isPaused ? "SPONSORSHIP PAUSED" : "ACTIVE & SERVING"}
            </span>
          </div>

          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
            When sponsorship is paused, users can still execute multisends by paying their own gas natively. Only free quota execution via relayer is temporarily suspended.
          </p>

          <div style={{ backgroundColor: "var(--bg-subtle)", padding: 16, borderRadius: 8, marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8, fontWeight: 600 }}>
              CONFIGURED SAFETY THRESHOLDS (ON-CHAIN ENFORCED):
            </div>
            <ul style={{ fontSize: 12, color: "var(--text-secondary)", paddingLeft: 18, lineHeight: 1.8 }}>
              <li>Per-Chunk Gas Reimbursement Cap: <strong style={{ color: "var(--text-primary)" }}>5.00 SOMI</strong></li>
              <li>Daily Global Spending Cap: <strong style={{ color: "var(--text-primary)" }}>500.00 SOMI</strong></li>
              <li>Pool Reserve Floor: <strong style={{ color: "var(--text-primary)" }}>10.00 SOMI</strong> (relayer cannot drain below this)</li>
              <li>Monthly User Quota: <strong style={{ color: "var(--text-primary)" }}>100 recipients / wallet</strong></li>
            </ul>
          </div>

          {canModifySponsorship ? (
            <button
              className={isPaused ? "admin-btn" : "admin-btn admin-btn-danger"}
              onClick={() => handleOpenSafetyModal(!isPaused)}
            >
              {isPaused ? (
                <>
                  <PlayCircle size={15} /> Resume Platform Sponsorship
                </>
              ) : (
                <>
                  <PauseCircle size={15} /> Emergency Pause Sponsorship
                </>
              )}
            </button>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              Sponsorship policy controls require <strong>Super Admin</strong> or <strong>Security</strong> role.
            </div>
          )}
        </div>

        {/* Contract Address & Details */}
        <div className="panel-card" style={{ marginBottom: 0 }}>
          <div className="panel-title" style={{ marginBottom: 16 }}>
            On-Chain Contract Verification
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 13 }}>
            <div>
              <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Gas Pool Contract</div>
              <div className="mono" style={{ fontSize: 12, marginTop: 2 }}>{data.gasPool.poolAddress}</div>
            </div>

            <div>
              <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Relayer Wallet Address</div>
              <div className="mono" style={{ fontSize: 12, marginTop: 2 }}>{data.relayer.address}</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <a
                href={`https://shannon-explorer.somnia.network/address/${data.gasPool.poolAddress}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "var(--text-primary)", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, textDecoration: "none" }}
              >
                Inspect Contract on Somnia Explorer <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Donations Table */}
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <Coins size={16} />
            Recent Community Donations
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Donor Address</th>
                <th>Amount (SOMI)</th>
                <th>Timestamp</th>
                <th>Tx Hash</th>
              </tr>
            </thead>
            <tbody>
              {data.gasPool.recentDonations && data.gasPool.recentDonations.length > 0 ? (
                data.gasPool.recentDonations.map((d, idx) => (
                  <tr key={idx}>
                    <td className="mono" style={{ fontSize: 12 }}>
                      {d.donor.slice(0, 8)}...{d.donor.slice(-6)}
                    </td>
                    <td className="mono" style={{ fontWeight: 600, color: "#34d399" }}>
                      +{parseFloat(d.amount).toFixed(2)} SOMI
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {new Date(d.timestamp).toLocaleString()}
                    </td>
                    <td>
                      <a
                        href={`https://shannon-explorer.somnia.network/tx/${d.txHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mono"
                        style={{ color: "var(--text-secondary)", display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none", fontSize: 12 }}
                      >
                        {d.txHash.slice(0, 8)}... <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    No community donations recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Safety Modal for Emergency Pause */}
      <SafetyModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        onConfirm={handleExecuteToggle}
        title={targetPauseState ? "Emergency Pause Platform Sponsorship" : "Resume Platform Sponsorship"}
        description={
          targetPauseState
            ? "You are about to pause all sponsored multisender transactions across the platform. Users will only be able to perform transfers by paying their own gas directly."
            : "You are about to re-enable sponsored transactions for qualified users with remaining monthly quotas."
        }
        requiredPhrase={targetPauseState ? "PAUSE SPONSORSHIP" : "RESUME SPONSORSHIP"}
        dangerLevel={targetPauseState ? "critical" : "high"}
        confirmButtonText={targetPauseState ? "Confirm & Pause Sponsorship" : "Confirm & Resume Sponsorship"}
      />
    </div>
  );
};
