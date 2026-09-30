import React, { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface SafetyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description: string;
  requiredPhrase: string;
  dangerLevel?: "high" | "critical";
  confirmButtonText: string;
}

export const SafetyModal: React.FC<SafetyModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  requiredPhrase,
  dangerLevel = "high",
  confirmButtonText,
}) => {
  const [typedPhrase, setTypedPhrase] = useState("");
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  const isConfirmed = typedPhrase.trim().toUpperCase() === requiredPhrase.toUpperCase() && reason.trim().length >= 8;

  const handleConfirm = () => {
    if (!isConfirmed) return;
    onConfirm(reason);
    setTypedPhrase("");
    setReason("");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div className="modal-title" style={{ color: dangerLevel === "critical" ? "var(--status-error)" : "var(--status-warning)" }}>
            <AlertTriangle size={20} />
            {title}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
          {description}
        </p>

        <div className="alert-banner alert-banner-danger" style={{ marginBottom: 16 }}>
          <div>
            <strong>High-assurance operational safety rule:</strong> This action will be immutably recorded in the platform audit log along with your role, IP address, and timestamp.
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
            Operational Justification / Reason (min 8 characters):
          </label>
          <input
            type="text"
            className="input-field"
            placeholder="e.g. Manual sync after RPC timeout alert"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>
            To proceed, type <span className="mono" style={{ color: "var(--text-primary)", fontWeight: 700 }}>{requiredPhrase}</span>:
          </label>
          <input
            type="text"
            className="input-field mono"
            placeholder={requiredPhrase}
            value={typedPhrase}
            onChange={(e) => setTypedPhrase(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button className="admin-btn admin-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className={dangerLevel === "critical" ? "admin-btn admin-btn-danger" : "admin-btn"}
            disabled={!isConfirmed}
            onClick={handleConfirm}
          >
            {confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
};
