import { createWalletClient, createPublicClient, http, parseEther, formatEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Somnia Native Multisender Deployment Script - Shannon Testnet & Mainnet
 */
async function main() {
  const env = process.env.DEPLOY_ENV || "testnet";
  const isMainnet = env === "mainnet";

  const expectedChainId = isMainnet ? 5031 : 50312;
  const tokenSymbol = isMainnet ? "SOMI" : "STT";
  const networkName = isMainnet ? "Somnia Mainnet" : "Somnia Shannon Testnet";
  const rpcUrl = isMainnet
    ? process.env.SOMNIA_MAINNET_RPC || "https://api.infra.mainnet.somnia.network/"
    : process.env.SOMNIA_TESTNET_RPC || "https://dream-rpc.somnia.network";

  console.log("=================================================");
  console.log(`Deploying Somnia Multisender Protocol`);
  console.log(`Target Network : ${networkName} (Expected Chain ID: ${expectedChainId})`);
  console.log(`Native Currency: ${tokenSymbol}`);
  console.log(`RPC Endpoint   : ${rpcUrl}`);
  console.log("=================================================");

  const deployerKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}`;
  if (!deployerKey || deployerKey === "0x0000000000000000000000000000000000000000000000000000000000000000") {
    throw new Error("DEPLOYER_PRIVATE_KEY is missing or set to placeholder. Configure a valid key in .env.");
  }

  const account = privateKeyToAccount(deployerKey);
  console.log(`Deployer Address: ${account.address}`);

  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  // Verify Remote Chain ID
  const remoteChainId = await publicClient.getChainId();
  if (remoteChainId !== expectedChainId) {
    throw new Error(`FATAL NETWORK MISMATCH: Expected chain ID ${expectedChainId} (${networkName}), but received ${remoteChainId}. Aborting deployment.`);
  }
  console.log(`[OK] RPC Chain ID Verified: ${remoteChainId}`);

  const walletClient = createWalletClient({
    account,
    transport: http(rpcUrl),
  });

  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Deployer Balance: ${formatEther(balance)} ${tokenSymbol}`);

  if (balance === 0n) {
    throw new Error(`Deployer balance is 0 ${tokenSymbol}. Fund the account before deployment.`);
  }

  // Load compiled artifacts
  const multisenderArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/Multisender.sol/Multisender.json"), "utf8")
  );
  const gasPoolArtifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/GasPool.sol/GasPool.json"), "utf8")
  );
  const mockERC20Artifact = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../artifacts/contracts/test/MockERC20.sol/MockERC20.json"), "utf8")
  );

  // 1. Deploy Multisender
  console.log("\n[1/5] Deploying Multisender.sol...");
  const multisenderHash = await walletClient.deployContract({
    abi: multisenderArtifact.abi,
    bytecode: multisenderArtifact.bytecode,
    args: [account.address],
  });
  console.log(`Multisender deploy tx submitted: ${multisenderHash}`);
  const multisenderReceipt = await publicClient.waitForTransactionReceipt({ hash: multisenderHash });
  const multisenderAddress = multisenderReceipt.contractAddress!;
  console.log(`Multisender deployed at: ${multisenderAddress} (Block: ${multisenderReceipt.blockNumber}, Gas: ${multisenderReceipt.gasUsed})`);

  // 2. Deploy GasPool (linked to Multisender address)
  console.log("\n[2/5] Deploying GasPool.sol linked to Multisender...");
  const gasPoolHash = await walletClient.deployContract({
    abi: gasPoolArtifact.abi,
    bytecode: gasPoolArtifact.bytecode,
    args: [account.address, multisenderAddress],
  });
  console.log(`GasPool deploy tx submitted: ${gasPoolHash}`);
  const gasPoolReceipt = await publicClient.waitForTransactionReceipt({ hash: gasPoolHash });
  const gasPoolAddress = gasPoolReceipt.contractAddress!;
  console.log(`GasPool deployed at: ${gasPoolAddress} (Block: ${gasPoolReceipt.blockNumber}, Gas: ${gasPoolReceipt.gasUsed})`);

  // 3. Configure Relayer Authorizations
  const relayerAddress = (process.env.INITIAL_RELAYER_ADDRESS && process.env.INITIAL_RELAYER_ADDRESS !== "0x0000000000000000000000000000000000000000")
    ? (process.env.INITIAL_RELAYER_ADDRESS as `0x${string}`)
    : account.address;

  console.log(`\n[3/5] Authorizing Relayer: ${relayerAddress}...`);

  // Authorize in Multisender
  const setRelayerTx = await walletClient.writeContract({
    address: multisenderAddress,
    abi: multisenderArtifact.abi,
    functionName: "setRelayerStatus",
    args: [relayerAddress, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: setRelayerTx });
  console.log(`Multisender relayer authorized (tx: ${setRelayerTx})`);

  // Authorize in GasPool
  const setOperatorTx = await walletClient.writeContract({
    address: gasPoolAddress,
    abi: gasPoolArtifact.abi,
    functionName: "setOperator",
    args: [relayerAddress, true],
  });
  await publicClient.waitForTransactionReceipt({ hash: setOperatorTx });
  console.log(`GasPool operator authorized (tx: ${setOperatorTx})`);

  // 4. Configure GasPool Spending Limits for Staging Safety
  console.log("\n[4/5] Configuring GasPool Spending Limits...");
  // per-chunk cap: 0.05 STT, daily cap: 1 STT, reserve floor: 0.01 STT
  const setLimitsTx = await walletClient.writeContract({
    address: gasPoolAddress,
    abi: gasPoolArtifact.abi,
    functionName: "setSpendingLimits",
    args: [parseEther("0.05"), parseEther("1"), parseEther("0.01")],
  });
  await publicClient.waitForTransactionReceipt({ hash: setLimitsTx });
  console.log(`GasPool spending limits configured (tx: ${setLimitsTx}): per-chunk: 0.05, daily: 1.0, reserve: 0.01`);

  // 5. Deploy Controlled Mock ERC-20 Token (TST) for Testnet
  let mockERC20Address = "0x0000000000000000000000000000000000000000";
  let mockERC20Tx = "";
  let mockReceipt: any = null;
  if (!isMainnet) {
    console.log("\n[5/5] Deploying Controlled Mock ERC-20 Token (STMT)...");
    mockERC20Tx = await walletClient.deployContract({
      abi: mockERC20Artifact.abi,
      bytecode: mockERC20Artifact.bytecode,
      args: ["Somnia Test Token", "STMT"],
    });
    console.log(`MockERC20 deploy tx submitted: ${mockERC20Tx}`);
    mockReceipt = await publicClient.waitForTransactionReceipt({ hash: mockERC20Tx as `0x${string}` });
    mockERC20Address = mockReceipt.contractAddress!;
    console.log(`MockERC20 deployed at: ${mockERC20Address} (Block: ${mockReceipt.blockNumber}, Gas: ${mockReceipt.gasUsed})`);
  }

  // Export fresh ABIs
  const exportDir = path.join(__dirname, "../exported-abis");
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }
  fs.writeFileSync(path.join(exportDir, "Multisender.json"), JSON.stringify({ contractName: "Multisender", abi: multisenderArtifact.abi }, null, 2));
  fs.writeFileSync(path.join(exportDir, "GasPool.json"), JSON.stringify({ contractName: "GasPool", abi: gasPoolArtifact.abi }, null, 2));
  if (!isMainnet) {
    fs.writeFileSync(path.join(exportDir, "MockERC20.json"), JSON.stringify({ contractName: "MockERC20", abi: mockERC20Artifact.abi }, null, 2));
  }
  console.log("\n[ABI Export] Fresh ABIs written to exported-abis/");

  // Save deployment summary
  const deploymentInfo = {
    network: networkName,
    chainId: remoteChainId,
    nativeSymbol: tokenSymbol,
    rpcUrl,
    deployerAddress: account.address,
    multisenderAddress,
    multisenderDeployTx: multisenderHash,
    multisenderBlockNumber: Number(multisenderReceipt.blockNumber),
    multisenderGasUsed: multisenderReceipt.gasUsed.toString(),
    gasPoolAddress,
    gasPoolDeployTx: gasPoolHash,
    gasPoolBlockNumber: Number(gasPoolReceipt.blockNumber),
    gasPoolGasUsed: gasPoolReceipt.gasUsed.toString(),
    relayerAddress,
    mockERC20Address,
    mockERC20DeployTx: mockERC20Tx,
    mockERC20BlockNumber: mockReceipt ? Number(mockReceipt.blockNumber) : null,
    mockERC20GasUsed: mockReceipt ? mockReceipt.gasUsed.toString() : null,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(__dirname, "../deployed-addresses.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log("\n=================================================");
  console.log("DEPLOYMENT COMPLETE & VERIFIED");
  console.log(`Network          : ${networkName} (${remoteChainId})`);
  console.log(`Multisender      : ${multisenderAddress}`);
  console.log(`GasPool          : ${gasPoolAddress}`);
  console.log(`Relayer Operator : ${relayerAddress}`);
  console.log(`Mock ERC-20 (STMT): ${mockERC20Address}`);
  console.log(`Deployment summary saved to deployed-addresses.json`);
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
