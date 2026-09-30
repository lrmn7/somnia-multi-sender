import React, { useState, useEffect } from "react";
import { useAccount, useWalletClient, usePublicClient } from "wagmi";
import { Toaster, toast } from "sonner";
import { parseUnits, keccak256, stringToHex } from "viem";
import { Navbar } from "./components/Navbar";
import { Executor, DistributionMode } from "./components/Executor";
import { DashboardView } from "./components/DashboardView";
import { GasPoolModal } from "./components/GasPoolModal";
import {
  fetchRuntimeConfig,
  fetchGasPoolMetrics,
  fallbackConfig,
  BackendConfig,
} from "./services/api";
import { RecipientEntry } from "./utils/distribution";

// Multisender ABI
const MULTISENDER_ABI = [
  {
    name: "sendNative",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "batchId", type: "bytes32" },
      { name: "chunkIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "sendToken",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "recipients", type: "address[]" },
      { name: "amounts", type: "uint256[]" },
      { name: "totalAmount", type: "uint256" },
      { name: "batchId", type: "bytes32" },
      { name: "chunkIndex", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

// Minimal ERC20 ABI
const ERC20_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<"executor" | "dashboard">("executor");
  const [isGasPoolModalOpen, setIsGasPoolModalOpen] = useState(false);
  const [config, setConfig] = useState<BackendConfig>(fallbackConfig);
  const [gasPoolMetrics, setGasPoolMetrics] = useState({
    onChainBalance: "0.0",
    totalDonors: 0,
  });

  const { address: userAddress, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  useEffect(() => {
    fetchRuntimeConfig().then(setConfig);
    loadGasPool();
  }, []);

  // Sync initial URL path
  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/dashboard" && isConnected) {
      setCurrentView("dashboard");
    } else if (path === "/dashboard" && !isConnected) {
      setCurrentView("executor");
      window.history.replaceState(null, "", "/");
    }
  }, [isConnected]);

  // If wallet disconnects while on dashboard, auto-return to executor
  useEffect(() => {
    if (!isConnected && currentView === "dashboard") {
      setCurrentView("executor");
      window.history.replaceState(null, "", "/");
    }
  }, [isConnected, currentView]);

  // Listen to browser navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path === "/dashboard" && isConnected) {
        setCurrentView("dashboard");
      } else {
        setCurrentView("executor");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isConnected]);

  const handleSelectView = (view: "executor" | "dashboard") => {
    if (view === "dashboard" && !isConnected) {
      toast.info("Please connect your wallet to access Dashboard");
      return;
    }
    setCurrentView(view);
    window.history.pushState(null, "", view === "dashboard" ? "/dashboard" : "/");
  };

  const loadGasPool = () => {
    fetchGasPoolMetrics().then((m) => {
      setGasPoolMetrics({
        onChainBalance: m.onChainBalance || "0.0",
        totalDonors: m.totalDonors || 0,
      });
    });
  };

  const handleExecuteDistribution = async (params: {
    tokenAddress: string | null;
    recipients: RecipientEntry[];
    totalAmountStr: string;
    mode: DistributionMode;
  }) => {
    if (!walletClient || !publicClient || !userAddress) {
      toast.error("Please connect your wallet first");
      return;
    }

    const { tokenAddress, recipients, totalAmountStr } = params;
    const multisenderAddr = config.contracts.multisender as `0x${string}`;

    if (!multisenderAddr || multisenderAddr === "0x0000000000000000000000000000000000000000") {
      toast.error("Multisender contract address is not configured yet on this network.");
      return;
    }

    // Dynamic safe chunk size: up to 173 per chunk for high safety on Somnia gas limit
    const SAFE_CHUNK_SIZE = 173;
    const chunkCount = Math.ceil(recipients.length / SAFE_CHUNK_SIZE);
    const batchIdHex = keccak256(stringToHex(`batch-${Date.now()}-${userAddress}`, { size: 32 }));

    // If ERC-20 token, check allowance first
    if (tokenAddress) {
      const selectedToken = config.tokens.find(
        (t) => t.address.toLowerCase() === tokenAddress.toLowerCase()
      );
      const decimals = selectedToken ? selectedToken.decimals : 18;
      const totalRequiredBase = parseUnits(totalAmountStr, decimals);

      toast.info("Checking token allowance...");
      const currentAllowance = (await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [userAddress, multisenderAddr],
      })) as bigint;

      if (currentAllowance < totalRequiredBase) {
        toast.loading("Awaiting allowance approval in wallet...");
        const approveTx = await walletClient.writeContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [multisenderAddr, totalRequiredBase],
        });
        toast.info("Approval submitted, waiting for confirmation...");
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        toast.success("Token allowance confirmed!");
      }
    }

    // Execute chunk by chunk
    for (let c = 0; c < chunkCount; c++) {
      const slice = recipients.slice(c * SAFE_CHUNK_SIZE, (c + 1) * SAFE_CHUNK_SIZE);
      const chunkRecipients = slice.map((r) => r.address as `0x${string}`);
      const chunkAmounts = slice.map((r) => BigInt(r.baseUnits));
      const chunkTotalBase = chunkAmounts.reduce((acc, cur) => acc + cur, 0n);

      const toastId = toast.loading(`Processing Chunk ${c + 1} of ${chunkCount} (${slice.length} recipients)...`);

      try {
        let hash: `0x${string}`;

        if (!tokenAddress) {
          // Native SOMI/STT
          hash = await walletClient.writeContract({
            address: multisenderAddr,
            abi: MULTISENDER_ABI,
            functionName: "sendNative",
            args: [chunkRecipients, chunkAmounts, batchIdHex, BigInt(c)],
            value: chunkTotalBase,
          });
        } else {
          // ERC-20 Token
          hash = await walletClient.writeContract({
            address: multisenderAddr,
            abi: MULTISENDER_ABI,
            functionName: "sendToken",
            args: [
              tokenAddress as `0x${string}`,
              chunkRecipients,
              chunkAmounts,
              chunkTotalBase,
              batchIdHex,
              BigInt(c),
            ],
          });
        }

        toast.info(`Chunk ${c + 1} broadcasted! Waiting for block inclusion...`, { id: toastId });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        if (receipt.status === "success") {
          toast.success(`Chunk ${c + 1} confirmed on Somnia! (Tx: ${hash.slice(0, 10)}...)`, { id: toastId });
        } else {
          toast.error(`Chunk ${c + 1} reverted on chain.`, { id: toastId });
          throw new Error(`Chunk ${c + 1} reverted`);
        }
      } catch (err: any) {
        toast.error(`Failed at Chunk ${c + 1}: ${err?.message || "Execution cancelled"}`, { id: toastId });
        throw err;
      }
    }

    toast.success("All distribution chunks executed successfully!");
    loadGasPool();
  };

  return (
    <div className="app-container">
      <Toaster
        position="top-right"
        theme="dark"
        richColors
        toastOptions={{
          style: {
            background: "rgba(18, 18, 22, 0.92)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(12px)",
            color: "#ffffff",
          },
        }}
      />

      <Navbar
        currentView={currentView}
        onSelectView={handleSelectView}
        isConnected={isConnected}
        config={config}
      />

      <main className="main-content">
        {currentView === "executor" ? (
          <Executor
            config={config}
            userAddress={userAddress}
            onExecuteDistribution={handleExecuteDistribution}
            gasPoolBalance={gasPoolMetrics.onChainBalance}
            donorCount={gasPoolMetrics.totalDonors}
            onOpenGasPoolModal={() => setIsGasPoolModalOpen(true)}
          />
        ) : (
          <DashboardView
            userAddress={userAddress}
            config={config}
            gasPoolMetrics={gasPoolMetrics}
            onOpenGasPoolModal={() => setIsGasPoolModalOpen(true)}
            onCreateDistribution={() => handleSelectView("executor")}
          />
        )}
      </main>

      <GasPoolModal
        config={config}
        isOpen={isGasPoolModalOpen}
        onClose={() => setIsGasPoolModalOpen(false)}
        onDonationSuccess={loadGasPool}
      />
    </div>
  );
};
