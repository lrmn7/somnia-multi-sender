import React from "react";
import { Droplets, HeartHandshake } from "lucide-react";
import { BackendConfig } from "../services/api";

interface HeroProps {
  config: BackendConfig;
  gasPoolBalance: string;
  donorCount: number;
  onOpenGasPoolModal: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  config,
  gasPoolBalance,
  donorCount,
  onOpenGasPoolModal,
}) => {
  return (
    <section className="hero-section">
      <div>
        <h1 className="hero-title">Token Distribution Utility</h1>
        <p className="hero-subtitle">
          Distribute native {config.chain.nativeSymbol} and allowlisted ERC-20 tokens to up to 2,500
          recipients per batch with sub-second finality and community gas pool sponsorship.
        </p>
      </div>

      <div className="gas-pool-bar">
        <Droplets size={20} color="#a1a1aa" />
        <div className="gas-pool-stat">
          <span className="gas-pool-label">Community Pool</span>
          <span className="gas-pool-value">
            {gasPoolBalance} {config.chain.nativeSymbol}
          </span>
        </div>
        <div
          style={{
            height: "24px",
            width: "1px",
            backgroundColor: "var(--border-subtle)",
          }}
        />
        <div className="gas-pool-stat">
          <span className="gas-pool-label">Donors</span>
          <span className="gas-pool-value">{donorCount}</span>
        </div>
        <button
          onClick={onOpenGasPoolModal}
          className="btn btn-secondary btn-sm"
          style={{ marginLeft: "4px" }}
        >
          <HeartHandshake size={14} />
          <span>Donate</span>
        </button>
      </div>
    </section>
  );
};
