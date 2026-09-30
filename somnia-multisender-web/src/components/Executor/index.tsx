import React, { useState, useId, useMemo } from "react";
import { isAddress, parseUnits, formatUnits } from "viem";
import { toast } from "sonner";
import { BackendConfig } from "../../services/api";
import {
  RecipientEntry,
  calculateEqualDistribution,
  generateBoundedRandomDistribution,
} from "../../utils/distribution";
import { ConfirmModal } from "./ConfirmModal";
import { Download, FileText } from "lucide-react";

export type DistributionMode = "equal" | "random" | "custom";

interface ExecutorProps {
  config: BackendConfig;
  userAddress?: string;
  onExecuteDistribution: (params: {
    tokenAddress: string | null;
    recipients: RecipientEntry[];
    totalAmountStr: string;
    mode: DistributionMode;
  }) => Promise<void>;
  gasPoolBalance?: string;
  donorCount?: number;
  onOpenGasPoolModal?: () => void;
}

export const Executor: React.FC<ExecutorProps> = ({
  config,
  userAddress,
  onExecuteDistribution,
  gasPoolBalance = "0.0",
  donorCount = 0,
  onOpenGasPoolModal,
}) => {
  const nativeSymbol = config.chain?.nativeSymbol || "STT";
  const [mode, setMode] = useState<DistributionMode>("equal");
  const [tokenType, setTokenType] = useState<"native" | "erc20">("native");
  const [erc20Address, setErc20Address] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState(nativeSymbol);
  const [tokenDecimals, setTokenDecimals] = useState(18);

  const [rawText, setRawText] = useState("");
  const [totalAmountInput, setTotalAmountInput] = useState("");
  const [minAmountInput, setMinAmountInput] = useState("");
  const [maxAmountInput, setMaxAmountInput] = useState("");

  const [parsedRecipients, setParsedRecipients] = useState<RecipientEntry[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputId = useId();

  // Handle Token Switch
  const handleTokenTypeChange = (type: "native" | "erc20") => {
    setTokenType(type);
    if (type === "native") {
      setTokenSymbol(nativeSymbol);
      setTokenDecimals(18);
      setErc20Address("");
    } else {
      setTokenSymbol("TOKEN");
    }
  };

  // Strict File Upload Validation (Max 2 MB, Max 2,500 rows)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_FILE_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds 2 MB limit.`);
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        if (file.name.endsWith(".json")) {
          const parsed = JSON.parse(content);
          if (!Array.isArray(parsed)) {
            toast.error("JSON file must be an array of objects or addresses.");
            return;
          }
          if (parsed.length > 2500) {
            toast.error(`JSON array contains ${parsed.length} entries, exceeding maximum limit of 2,500.`);
            return;
          }
          const formatted = parsed.map((item: any) => {
            if (typeof item === "string") return item;
            return `${item.address || item.recipient},${item.amount || "0"}`;
          });
          setRawText(formatted.join("\n"));
        } else {
          const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length > 2500) {
            toast.error(`CSV contains ${lines.length} rows, exceeding maximum limit of 2,500 rows.`);
            return;
          }
          setRawText(content);
        }
        toast.success(`Loaded file (${file.name}) successfully.`);
      } catch (err: any) {
        toast.error(`Failed to parse file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      mode === "custom"
        ? "0x70997970C51812dc3A010C7d01b50e0d17dc79C8, 1.5\n0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, 2.0\n0x90F79bf6EB2c4f870365E785982E1f101E93b906, 0.75\n0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65, 3.2\n0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc, 0.5"
        : "0x70997970C51812dc3A010C7d01b50e0d17dc79C8\n0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC\n0x90F79bf6EB2c4f870365E785982E1f101E93b906\n0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65\n0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sample_multisend_${mode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Sample CSV format downloaded.");
  };

  const handleDownloadSampleJson = () => {
    const jsonContent =
      mode === "custom"
        ? JSON.stringify(
            [
              { address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", amount: "1.5" },
              { address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC", amount: "2.0" },
              { address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906", amount: "0.75" },
              { address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65", amount: "3.2" },
              { address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc", amount: "0.5" },
            ],
            null,
            2
          )
        : JSON.stringify(
            [
              "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
              "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
              "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
              "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
              "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
            ],
            null,
            2
          );
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sample_multisend_${mode}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Sample JSON format downloaded.");
  };

  // Calculate dynamic chunking plan
  const chunkPlan = useMemo(() => {
    const count = parsedRecipients.length;
    if (count === 0) return { chunkCount: 0, chunks: [], summaryText: "0 chunks" };

    const SAFE_CHUNK_SIZE = 173;
    const chunkCount = Math.ceil(count / SAFE_CHUNK_SIZE);
    const chunks: number[] = [];

    let remaining = count;
    for (let i = 0; i < chunkCount; i++) {
      const current = Math.min(remaining, SAFE_CHUNK_SIZE);
      chunks.push(current);
      remaining -= current;
    }

    const summaryText =
      chunkCount === 1
        ? `${count} recipients (1 chunk)`
        : `${count} recipients across ${chunkCount} chunks (${chunks.join(" + ")})`;

    return { chunkCount, chunks, summaryText };
  }, [parsedRecipients.length]);

  // Parse and calculate distribution
  const handleCalculate = () => {
    try {
      const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) {
        toast.error("Please enter recipient addresses.");
        return;
      }
      if (lines.length > 2500) {
        toast.error(`Recipient count (${lines.length}) exceeds maximum limit of 2,500.`);
        return;
      }

      if (mode === "equal") {
        if (!totalAmountInput || parseFloat(totalAmountInput) <= 0) {
          toast.error("Please enter a valid total pool amount.");
          return;
        }
        const addresses: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          const addr = lines[i].split(/[,;\s\t]+/)[0].trim();
          if (!isAddress(addr)) {
            throw new Error(`Invalid address at line ${i + 1}: ${addr}`);
          }
          addresses.push(addr);
        }
        const result = calculateEqualDistribution(totalAmountInput, addresses, tokenDecimals);
        setParsedRecipients(result.entries);
        toast.success(`Calculated equal distribution for ${result.entries.length} recipients.`);
      } else if (mode === "random") {
        if (!totalAmountInput || parseFloat(totalAmountInput) <= 0) {
          toast.error("Please enter a valid total pool amount.");
          return;
        }
        const addresses: string[] = [];
        for (let i = 0; i < lines.length; i++) {
          const addr = lines[i].split(/[,;\s\t]+/)[0].trim();
          if (!isAddress(addr)) {
            throw new Error(`Invalid address at line ${i + 1}: ${addr}`);
          }
          addresses.push(addr);
        }
        const result = generateBoundedRandomDistribution({
          recipientAddresses: addresses,
          totalAmountStr: totalAmountInput,
          minAmountStr: minAmountInput || undefined,
          maxAmountStr: maxAmountInput || undefined,
          decimals: tokenDecimals,
        });
        setParsedRecipients(result.entries);
        toast.success(
          `Generated bounded random distribution for ${result.entries.length} recipients.`
        );
      } else {
        // Custom amounts
        const entries: RecipientEntry[] = [];
        for (let i = 0; i < lines.length; i++) {
          const parts = lines[i].split(/[,;\s\t]+/).filter(Boolean);
          if (parts.length < 2) {
            throw new Error(`Line ${i + 1} must have format: <address>, <amount>`);
          }
          const addr = parts[0].trim();
          const amt = parts[1].trim();
          if (!isAddress(addr)) {
            throw new Error(`Invalid address at line ${i + 1}: ${addr}`);
          }
          if (isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) {
            throw new Error(`Invalid amount at line ${i + 1}: ${amt}`);
          }
          const baseUnits = parseUnits(amt, tokenDecimals).toString();
          entries.push({ address: addr, amount: amt, baseUnits });
        }
        setParsedRecipients(entries);
        toast.success(`Validated ${entries.length} custom recipient entries.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process recipients");
    }
  };

  const totalCalculatedAmount = parsedRecipients.reduce(
    (acc, curr) => acc + BigInt(curr.baseUnits),
    0n
  );
  const totalDisplayAmount = formatUnits(totalCalculatedAmount, tokenDecimals);
  const isSponsorshipEligible = parsedRecipients.length > 0 && parsedRecipients.length <= 100;

  const handleOpenConfirm = () => {
    if (parsedRecipients.length === 0) {
      toast.error("Please calculate or validate recipients first.");
      return;
    }
    if (!userAddress) {
      toast.error("Please connect your wallet first.");
      return;
    }
    setIsConfirmOpen(true);
  };

  const handleConfirmExecution = async () => {
    setIsProcessing(true);
    try {
      await onExecuteDistribution({
        tokenAddress: tokenType === "erc20" ? erc20Address : null,
        recipients: parsedRecipients,
        totalAmountStr: totalDisplayAmount,
        mode,
      });
      setIsConfirmOpen(false);
      setParsedRecipients([]);
      setRawText("");
      setTotalAmountInput("");
    } catch (err: any) {
      // Handled in parent
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="executor-wrapper">
      {/* Hero Section matching reference */}
      <div className="executor-hero-header">
        <div className="network-pill-badge">
          <span className="network-pill-dot" />
          <span>Somnia Testnet · Shannon</span>
        </div>
        <h1 className="executor-hero-title">
          Multisend on <span className="somnia-bracket-mark">&#123;S&#125;omnia</span>
        </h1>
        <p className="executor-hero-desc">
          Send native {nativeSymbol} and ERC-20 tokens to thousands of recipients in one transaction.
        </p>
      </div>

      {/* Primary Glass Interaction Surface */}
      <div className="executor-primary-card">
        {/* Card Top Row with Operational Status Badge */}
        <div className="card-top-bar">
          <div className="gas-pool-context-box">
            <div className="gas-pool-context-info">
              <span className="gas-pool-context-name">Community Gas Pool:</span>
              <span className="gas-pool-context-desc">
                {isSponsorshipEligible
                  ? "Eligible for sponsorship"
                  : "Self-paid execution"}
              </span>
            </div>
            {onOpenGasPoolModal && (
              <button
                type="button"
                onClick={onOpenGasPoolModal}
                className="btn-donate-context"
              >
                Donate
              </button>
            )}
          </div>

          <div className="card-operational-badge">
            <span className="operational-dot" />
            <span>Operational</span>
          </div>
        </div>

        {/* Section 1: Asset Selection */}
        <div className="form-group-block">
          <label className="form-group-label">Asset</label>
          <div className="segmented-control" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tokenType === "native"}
              className={`segmented-btn ${tokenType === "native" ? "active" : ""}`}
              onClick={() => handleTokenTypeChange("native")}
            >
              Native {nativeSymbol}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tokenType === "erc20"}
              className={`segmented-btn ${tokenType === "erc20" ? "active" : ""}`}
              onClick={() => handleTokenTypeChange("erc20")}
            >
              ERC-20 Token
            </button>
          </div>

          {tokenType === "erc20" && (
            <div className="subfield-wrapper">
              <label className="subfield-label">Token Contract Address</label>
              <input
                type="text"
                placeholder="0x... contract address on Somnia"
                value={erc20Address}
                onChange={(e) => setErc20Address(e.target.value.trim())}
                className="glass-input mono"
              />
            </div>
          )}
        </div>

        {/* Section 2: Distribution Mode */}
        <div className="form-group-block">
          <label className="form-group-label">Distribution Mode</label>
          <div className="segmented-control" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "equal"}
              className={`segmented-btn ${mode === "equal" ? "active" : ""}`}
              onClick={() => {
                setMode("equal");
                setParsedRecipients([]);
              }}
            >
              Equal Split
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "random"}
              className={`segmented-btn ${mode === "random" ? "active" : ""}`}
              onClick={() => {
                setMode("random");
                setParsedRecipients([]);
              }}
            >
              Random Split
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "custom"}
              className={`segmented-btn ${mode === "custom" ? "active" : ""}`}
              onClick={() => {
                setMode("custom");
                setParsedRecipients([]);
              }}
            >
              Custom Amounts
            </button>
          </div>
        </div>

        {/* Section 3: Amount Configuration (if Equal or Random) */}
        {(mode === "equal" || mode === "random") && (
          <div className="form-group-block">
            <label className="form-group-label">
              Total Pool Amount ({tokenSymbol})
            </label>
            <input
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={totalAmountInput}
              onChange={(e) => setTotalAmountInput(e.target.value)}
              className="glass-input mono amount-input"
            />

            {mode === "random" && (
              <div className="bounds-grid">
                <div>
                  <label className="subfield-label">Min per Recipient (Optional)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 1.0"
                    value={minAmountInput}
                    onChange={(e) => setMinAmountInput(e.target.value)}
                    className="glass-input mono"
                  />
                </div>
                <div>
                  <label className="subfield-label">Max per Recipient (Optional)</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 50.0"
                    value={maxAmountInput}
                    onChange={(e) => setMaxAmountInput(e.target.value)}
                    className="glass-input mono"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 4: Recipients & Deliberate Drop / Upload Area */}
        <div className="form-group-block">
          <div className="field-header-row">
            <label className="form-group-label">
              {mode === "equal" || mode === "random"
                ? "Recipients"
                : "Recipients & Custom Amounts"}
            </label>
            <span className="field-helper-text">Up to 2,500 addresses</span>
          </div>

          {/* Interactive Drop / Upload Area with Sample Downloads */}
          <div className="upload-drop-surface">
            <div className="upload-main-action">
              <span className="upload-drop-text">Drop CSV / JSON here or</span>
              <label htmlFor={fileInputId} className="upload-action-btn">
                Choose file
              </label>
              <input
                id={fileInputId}
                type="file"
                accept=".csv,.txt,.json"
                style={{ display: "none" }}
                onChange={handleFileUpload}
              />
            </div>
            <div className="sample-download-row">
              <span className="sample-download-label">Sample format:</span>
              <button
                type="button"
                className="sample-download-btn"
                onClick={handleDownloadSampleCsv}
                title="Download sample CSV template"
              >
                <Download size={12} />
                <span>CSV</span>
              </button>
              <button
                type="button"
                className="sample-download-btn"
                onClick={handleDownloadSampleJson}
                title="Download sample JSON template"
              >
                <Download size={12} />
                <span>JSON</span>
              </button>
            </div>
          </div>

          <textarea
            rows={7}
            className="glass-textarea mono"
            placeholder={
              mode === "equal" || mode === "random"
                ? "0x70997970C51812dc3A010C7d01b50e0d17dc79C8\n0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC\n0x90F79bf6EB2c4f870365E785982E1f101E93b906"
                : "0x70997970C51812dc3A010C7d01b50e0d17dc79C8, 25.5\n0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC, 10.0"
            }
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />

          <div className="calculate-action-row">
            <button
              type="button"
              className="btn-calculate"
              onClick={handleCalculate}
            >
              Parse & Calculate
            </button>
          </div>
        </div>

        {/* Section 5: Execution Summary (Clean Typography & Lines, No Nested Cards) */}
        {parsedRecipients.length > 0 && (
          <div className="summary-block">
            <div className="summary-heading">Execution Summary</div>
            <div className="summary-rows">
              <div className="summary-line">
                <span className="summary-key">Recipients</span>
                <span className="summary-val mono">
                  {parsedRecipients.length} addresses
                </span>
              </div>
              <div className="summary-line">
                <span className="summary-key">Total Outflow</span>
                <span className="summary-val mono">
                  {totalDisplayAmount} {tokenSymbol}
                </span>
              </div>
              <div className="summary-line">
                <span className="summary-key">Execution Chunks</span>
                <span className="summary-val mono">
                  {chunkPlan.summaryText}
                </span>
              </div>
              <div className="summary-line">
                <span className="summary-key">Estimated Network Fee</span>
                <span className="summary-val mono">
                  {isSponsorshipEligible
                    ? "Sponsored (Community Gas Pool)"
                    : `~${(chunkPlan.chunkCount * 0.002).toFixed(3)} ${nativeSymbol}`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Section 6: Dominant Primary Execute Action */}
        <div className="primary-action-container">
          <button
            type="button"
            className="btn-primary-execute"
            onClick={handleOpenConfirm}
            disabled={isProcessing || parsedRecipients.length === 0}
          >
            {isProcessing ? (
              <>
                <span className="btn-spinner" />
                <span>Broadcasting Transaction...</span>
              </>
            ) : parsedRecipients.length > 0 ? (
              <>
                <span>Execute Distribution ({parsedRecipients.length} Recipients)</span>
                <span className="btn-arrow-symbol">→</span>
              </>
            ) : (
              <>
                <span>Calculate & Execute Distribution</span>
                <span className="btn-arrow-symbol">→</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <ConfirmModal
          config={config}
          userAddress={userAddress || ""}
          tokenSymbol={tokenSymbol}
          tokenAddress={tokenType === "erc20" ? erc20Address : null}
          recipients={parsedRecipients}
          totalAmount={totalDisplayAmount}
          chunkPlan={chunkPlan}
          onClose={() => setIsConfirmOpen(false)}
          onConfirm={handleConfirmExecution}
        />
      )}
    </div>
  );
};
