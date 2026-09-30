# Somnia Multisender

Somnia Multisender is a token and native asset batch transfer application designed for the Somnia network. It enables sending native tokens and ERC-20 tokens to multiple recipients in single transactions or partitioned chunks, with an optional gas sponsorship pool.

## Overview

The system allows users to distribute native tokens (STT on Shannon Testnet, SOMI on Mainnet) and ERC-20 tokens to multiple addresses. When recipient lists exceed single-transaction gas budgets, the application partitions distributions into chunks. An on-chain community gas pool contract enables sponsored distributions where authorized relayers execute transactions on behalf of users, up to configured monthly quota limits.

## Repository Structure

The workspace is organized into four sub-projects:

- `somnia-multisender-web/`: Frontend React application using Vite, Tailwind CSS, Viem, and RainbowKit. Provides the user interface for preparing recipient lists, choosing distribution modes, calculating allocations, and submitting transactions.
- `somnia-multisender-api/`: Backend API and indexer service built with Hono, Drizzle ORM, and MySQL. Manages batch distribution plans, idempotency, monthly sponsorship quotas, transaction tracking, and event reconciliation.
- `somnia-multisender-contracts/`: Smart contract suite developed with Hardhat and Solidity. Contains the `Multisender` distribution contract, `GasPool` community sponsorship contract, test mocks, and deployment scripts.
- `somnia-multisender-admin/`: Operator portal built with React and Vite. Allows administrators to monitor system health, view audit logs, track gas pool balances, inspect transactions, and trigger emergency pause controls.

## Features

- Native token multi-send (fixed amounts or custom allocations per recipient).
- ERC-20 token multi-send with automated allowance checks and approval workflows.
- Gas-aware recipient list chunking to stay within safe execution gas limits (max 500 recipients per chunk).
- Community Gas Pool support allowing gas fee sponsorship for eligible wallets.
- Monthly wallet sponsorship quotas tracked and enforced by the backend API.
- Reentrancy protection and fail-closed state management across contracts and API.
- Idempotent batch planning preventing duplicate submissions.
- Role-based operator portal for monitoring, audit trails, and administrative pause controls.

## Networks

### Shannon Testnet
- Network Name: Somnia Shannon Testnet
- Chain ID: 50312
- Native Token: STT
- RPC Endpoint: https://dream-rpc.somnia.network
- Block Explorer: https://shannon-explorer.somnia.network/
- Status: Contracts deployed and verified. Deployed addresses are recorded in `somnia-multisender-contracts/deployed-addresses.json`.

### Somnia Mainnet
- Network Name: Somnia Mainnet
- Chain ID: 5031
- Native Token: SOMI
- RPC Endpoint: https://api.infra.mainnet.somnia.network/
- Block Explorer: https://explorer.somnia.network
- Status: Not deployed. Mainnet deployment is blocked pending a third-party smart contract security audit.

## Requirements

- Node.js 20.x or higher
- npm 10.x or higher
- MySQL 8.0 or higher (for `somnia-multisender-api`)

## Setup

1. Clone the repository and navigate to the project directory.

2. Install dependencies for each sub-project:

```bash
cd somnia-multisender-contracts && npm install && cd ..
cd somnia-multisender-api && npm install && cd ..
cd somnia-multisender-web && npm install && cd ..
cd somnia-multisender-admin && npm install && cd ..
```

3. Configure environment variables for each project by copying the example files:

```bash
cp somnia-multisender-contracts/.env.example somnia-multisender-contracts/.env
cp somnia-multisender-api/.env.example somnia-multisender-api/.env
cp somnia-multisender-web/.env.example somnia-multisender-web/.env
cp somnia-multisender-admin/.env.example somnia-multisender-admin/.env
```

4. Initialize the MySQL database:

Create the MySQL database if it does not already exist:

```sql
CREATE DATABASE IF NOT EXISTS somnia_multisender;
```

Apply database migrations:

```bash
cd somnia-multisender-api
npx drizzle-kit push
cd ..
```

## Development

Run individual components during development:

- Backend API:
```bash
cd somnia-multisender-api
npm run dev
```

- Web Application:
```bash
cd somnia-multisender-web
npm run dev
```

- Admin Portal:
```bash
cd somnia-multisender-admin
npm run dev
```

## Testing

Run tests and builds across each component:

- Smart Contracts:
```bash
cd somnia-multisender-contracts
npm run compile
npm test
```

- Backend API:
```bash
cd somnia-multisender-api
npm run typecheck
npm test
npm run build
```

- Web Application:
```bash
cd somnia-multisender-web
npm run typecheck
npm test
npm run build
```

- Admin Portal:
```bash
cd somnia-multisender-admin
npm run build
```

## Project Status

- Smart contracts compiled, tested (39 unit and scale tests passing), and deployed to Somnia Shannon Testnet.
- Full staging and hardening validation on Shannon Testnet completed.
- Mainnet deployment is not currently included.
- An external smart-contract security audit is required prior to mainnet deployment.

---
