import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { parseEther } from "viem";
import { useSendTransaction } from "wagmi";
import { BackendConfig } from "../services/api";

interface GasPoolModalProps {
  config: BackendConfig;
  isOpen: boolean;
  onClose: () => void;
  onDonationSuccess: () => void;
}

export const GasPoolModal: React.FC<GasPoolModalProps> = ({
  config,
  isOpen,
  onClose,
  onDonationSuccess,
}) => {
  const [amount, setAmount] = useState<string>("5");
  const [isDonating, setIsDonating] = useState<boolean>(false);
  const { sendTransactionAsync } = useSendTransaction();

  const nativeSymbol = config.chain?.nativeSymbol || "STT";
  const quickPills = ["2", "5", "10", "25", "50"];

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDonating && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isDonating, isOpen]);

  if (!isOpen) return null;

  const handleDonate = async () => {
    const gasPoolAddr = config.contracts.gasPool;
    if (!gasPoolAddr || gasPoolAddr === "0x0000000000000000000000000000000000000000") {
      toast.error("Gas pool contract address is not configured yet on this network.");
      return;
    }

    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid donation amount");
      return;
    }

    setIsDonating(true);
    toast.info("Awaiting wallet confirmation for community gas donation...");

    try {
      const hash = await sendTransactionAsync({
        to: gasPoolAddr as `0x${string}`,
        value: parseEther(amount),
      });

      toast.success(`Donation submitted! Tx: ${hash.slice(0, 10)}...`);
      onDonationSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Donation transaction cancelled or failed");
    } finally {
      setIsDonating(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gaspool-modal-title"
    >
      <div
        className="glass-modal modal-content modal-glass-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="gaspool-modal-title" className="modal-title">
            Community Gas Pool
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isDonating}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        <p className="modal-desc">
          Support the Somnia ecosystem by contributing native {nativeSymbol}.
          Donated funds subsidize gas fees for sponsored user distributions via the on-chain Gas Pool contract.
        </p>

        <div className="form-group-block" style={{ marginBottom: "16px" }}>
          <label className="form-group-label">Donation Amount ({nativeSymbol})</label>
          <input
            type="number"
            step="any"
            min="0"
            className="glass-input mono amount-input"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 5"
          />
        </div>

        <div className="quick-presets-row" style={{ marginBottom: "24px" }}>
          {quickPills.map((val) => (
            <button
              key={val}
              type="button"
              className={`preset-btn ${amount === val ? "active" : ""}`}
              onClick={() => setAmount(val)}
            >
              {val} {nativeSymbol}
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isDonating}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleDonate}
            disabled={isDonating}
          >
            {isDonating ? "Submitting..." : "Donate to Pool"}
          </button>
        </div>
      </div>
    </div>
  );
};
