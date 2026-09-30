import React, { useState, useEffect } from "react";
import { User, Send, ArrowDownLeft, Layers, Users, Zap, HeartHandshake } from "lucide-react";
import { fetchProfile, BackendConfig } from "../services/api";

interface ProfileViewProps {
  userAddress?: string;
  config: BackendConfig;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ userAddress, config }) => {
  const [period, setPeriod] = useState<"7D" | "30D" | "90D" | "ALL">("ALL");
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userAddress) {
      setIsLoading(true);
      fetchProfile(userAddress, period)
        .then((res) => setProfileData(res))
        .finally(() => setIsLoading(false));
    }
  }, [userAddress, period]);

  if (!userAddress) {
    return (
      <div className="card" style={{ textAlign: "center", padding: "60px 20px" }}>
        <User size={40} color="var(--text-muted)" style={{ margin: "0 auto 16px" }} />
        <h3>Connect Your Wallet</h3>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "6px" }}>
          Please connect your wallet to view your historical analytics and sponsored recipient credits.
        </p>
      </div>
    );
  }

  const periods: Array<"7D" | "30D" | "90D" | "ALL"> = ["7D", "30D", "90D", "ALL"];
  const metrics = profileData?.metrics;
  const quota = profileData?.quota;

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <h2>Account Activity</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Showing verified activity generated through this application only.
          </p>
        </div>

        <div style={{ display: "flex", gap: "6px", backgroundColor: "var(--bg-surface)", padding: "4px", borderRadius: "var(--radius-sm)" }}>
          {periods.map((p) => (
            <button
              key={p}
              className={`btn btn-sm ${period === p ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setPeriod(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "16px",
          marginBottom: "28px",
        }}
      >
        {/* Total Sent */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", marginBottom: "12px" }}>
            <Send size={18} />
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Sent Through App</span>
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            {metrics?.totalSentBaseUnits ? (Number(metrics.totalSentBaseUnits) / 1e18).toFixed(2) : "0.00"}{" "}
            <span style={{ fontSize: "1rem", color: "var(--text-muted)" }}>{config.chain.nativeSymbol}</span>
          </div>
        </div>

        {/* Total Received */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", marginBottom: "12px" }}>
            <ArrowDownLeft size={18} />
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Received Through App</span>
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            {metrics?.totalReceivedBaseUnits ? (Number(metrics.totalReceivedBaseUnits) / 1e18).toFixed(2) : "0.00"}{" "}
            <span style={{ fontSize: "1rem", color: "var(--text-muted)" }}>{config.chain.nativeSymbol}</span>
          </div>
        </div>

        {/* Batches Executed */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", marginBottom: "12px" }}>
            <Layers size={18} />
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Batches Executed</span>
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            {metrics?.totalBatchesExecuted || 0}
          </div>
        </div>

        {/* Total Recipients */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", marginBottom: "12px" }}>
            <Users size={18} />
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Recipients Reached</span>
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            {metrics?.totalRecipientsReached || 0}
          </div>
        </div>

        {/* Sponsored Recipient Credits */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", marginBottom: "12px" }}>
            <Zap size={18} />
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Sponsored Credits</span>
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--status-warning)" }}>
            {quota?.remainingCredits ?? 100}{" "}
            <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>/ {quota?.totalAllowance ?? 100}</span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Monthly allowance for {quota?.monthKey || "current month"}
          </p>
        </div>

        {/* Donated to Gas Pool */}
        <div className="card">
          <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", marginBottom: "12px" }}>
            <HeartHandshake size={18} />
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>Donated to Gas Pool</span>
          </div>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
            {metrics?.totalDonatedBaseUnits ? (Number(metrics.totalDonatedBaseUnits) / 1e18).toFixed(2) : "0.00"}{" "}
            <span style={{ fontSize: "1rem", color: "var(--text-muted)" }}>{config.chain.nativeSymbol}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
