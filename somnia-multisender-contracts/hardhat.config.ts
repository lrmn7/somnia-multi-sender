import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-viem";
import * as dotenv from "dotenv";

dotenv.config();

const SOMNIA_TESTNET_RPC = process.env.SOMNIA_TESTNET_RPC_URL || process.env.SOMNIA_TESTNET_RPC || "https://dream-rpc.somnia.network";
const SOMNIA_MAINNET_RPC = process.env.SOMNIA_MAINNET_RPC_URL || "https://api.infra.mainnet.somnia.network/";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000001";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 500,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 31337,
    },
    somnia_testnet: {
      type: "http",
      url: SOMNIA_TESTNET_RPC,
      chainId: 50312,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
    somnia_mainnet: {
      type: "http",
      url: SOMNIA_MAINNET_RPC,
      chainId: 5031,
      accounts: [DEPLOYER_PRIVATE_KEY],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
