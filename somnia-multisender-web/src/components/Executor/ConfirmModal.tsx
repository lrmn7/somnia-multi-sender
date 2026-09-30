import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { BackendConfig, requestSponsorQuote } from "../../services/api";
import { RecipientEntry } from "../../utils/distribution";

interface ConfirmModalProps {
  config: BackendConfig;
  userAddress: string;
  tokenSymbol: string;
  tokenAddress: string | null;
  recipients: RecipientEntry[];
  totalAmount: string;
  chunkPlan: {
    chunkCount: number;
    chunks: number[];
    summaryText: string;
  };
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  config,
  userAddress,
  tokenSymbol,
  tokenAddress,
  recipients,
  totalAmount,
  chunkPlan,
  onClose,
  onConfirm,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sponsorEligible, setSponsorEligible] = useState<boolean>(false);
  const [remainingCredits, setRemainingCredits] = useState<number>(0);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, isSubmitting]);

  useEffect(() => {
    if (tokenAddress && userAddress) {
      requestSponsorQuote(userAddress, recipients.length, tokenAddress)
        .then((res) => {
          if (res?.eligible) {
            setSponsorEligible(true);
            setRemainingCredits(res.remainingCredits);
          }
        })
        .catch(() => {});
    }
  }, [userAddress, tokenAddress, recipients.length]);

  const handleConfirmClick = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="glass-modal modal-content modal-glass-container"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h2 id="confirm-modal-title" className="modal-title">
            Review Distribution
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Breakdown Items */}
        <div className="modal-body-rows">
          <div className="modal-row">
            <span className="modal-row-label">Total Outflow</span>
            <span className="modal-row-val mono primary-emphasis">
              {totalAmount} {tokenSymbol}
            </span>
          </div>

          <div className="modal-row">
            <span className="modal-row-label">Recipient Count</span>
            <span className="modal-row-val mono">
              {recipients.length} addresses
            </span>
          </div>

          <div className="modal-row">
            <span className="modal-row-label">Execution Chunks</span>
            <span className="modal-row-val mono">
              {chunkPlan.chunkCount}{" "}
              {chunkPlan.chunkCount > 1 ? "atomic chunks" : "single chunk"}
            </span>
          </div>

          <div className="modal-row">
            <span className="modal-row-label">Network Fee</span>
            <span className="modal-row-val">
              {sponsorEligible ? (
                <span className="status-sponsored-text">
                  Sponsored ({remainingCredits} credits remaining)
                </span>
              ) : (
                <span className="status-selfpaid-text">
                  User-Paid ({config.chain.nativeSymbol})
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Dynamic Chunk Plan Note */}
        {chunkPlan.chunkCount > 1 && (
          <div className="modal-notice-box">
            <span className="modal-notice-title">Gas-Aware Execution Plan:</span>
            <p className="modal-notice-text">
              Executed across {chunkPlan.chunkCount} chunks ({chunkPlan.chunks.join(" + ")}).
              Sized to remain safely within the 50,000,000 application-level safe execution budget per chunk.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirmClick}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting to Wallet..." : "Confirm & Broadcast"}
          </button>
        </div>
      </div>
    </div>
  );
};
