# Frontend Migration Guide (Stellar to Botchain EVM)

This guide provides the necessary steps to update your Next.js application to interact with the new Botchain EVM smart contract, replacing the existing Stellar dependencies.

## 1. Update Dependencies

First, you need to remove the Stellar SDKs and install standard EVM libraries like Wagmi and Viem.

**Remove Stellar packages:**
```bash
npm uninstall @stellar/stellar-sdk @creit-tech/stellar-wallets-kit
```

**Install EVM packages:**
```bash
npm install wagmi viem @tanstack/react-query
```

## 2. Setup Wagmi Provider

In your `src/app/layout.tsx` or a dedicated provider component (e.g. `src/components/Providers.tsx`), set up the Wagmi config and QueryClient.

```tsx
'use client';

import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains'; // Replace with Botchain's network config
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { injected } from 'wagmi/connectors';

// Configure your Botchain network here if it's custom
const botchain = {
  id: 1337, // Replace with Botchain Chain ID
  name: 'Botchain',
  nativeCurrency: { name: 'Botchain Token', symbol: 'BOT', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.botchain.network'] }, // Replace with actual RPC
  },
} as const;

export const config = createConfig({
  chains: [botchain],
  connectors: [injected()],
  transports: {
    [botchain.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```
*Make sure to wrap your `layout.tsx` children in `<Providers>`.*

## 3. Update Wallet Connection Components

Replace the `StellarWalletsKit` connection logic with Wagmi's `useConnect` and `useAccount`.

```tsx
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from 'wagmi/connectors';

export function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div>
        <p>Connected: {address}</p>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  return (
    <button onClick={() => connect({ connector: injected() })}>
      Connect Wallet
    </button>
  );
}
```

## 4. Rewrite Contract Interactions (`src/lib/contract.ts`)

You will need the ABI of your deployed `ChitFund.sol` contract. Save it as `src/lib/ChitFundABI.ts`.
Then replace the functions in `contract.ts` using Wagmi's `writeContract` (for mutations) and `readContract` (for views). 

Example of migrating `createChitFund` and `deposit`:

```ts
import { writeContract, readContract, waitForTransactionReceipt } from '@wagmi/core';
import { config } from './providers'; // Import your wagmi config
import { parseEther } from 'viem';
import { ChitFundABI } from './ChitFundABI';

const CONTRACT_ADDRESS = '0xYourContractAddress...';

// 1. Create Fund
export async function createChitFund(
  name: string,
  contribution: number,
  memberCount: number
) {
  const contributionAmount = parseEther(contribution.toString());
  
  const hash = await writeContract(config, {
    address: CONTRACT_ADDRESS,
    abi: ChitFundABI,
    functionName: 'createFund',
    args: [name, contributionAmount, memberCount],
  });

  const receipt = await waitForTransactionReceipt(config, { hash });
  return receipt.transactionHash;
}

// 2. Deposit
export async function deposit(
  fundId: number,
  amount: number
) {
  const depositAmount = parseEther(amount.toString());

  // Call deposit on ChitFund and send native BOT as value
  const hash = await writeContract(config, {
    address: CONTRACT_ADDRESS,
    abi: ChitFundABI,
    functionName: 'deposit',
    args: [fundId],
    value: depositAmount,
  });

  return await waitForTransactionReceipt(config, { hash });
}

// 3. Read Fund Summary
export async function getFundSummary(fundId: number) {
  const result = await readContract(config, {
    address: CONTRACT_ADDRESS,
    abi: ChitFundABI,
    functionName: 'getFundSummary',
    args: [fundId],
  });
  
  return result; // Format this as needed for your UI
}
```

## 5. Remove `stellar.ts`

You can safely delete `src/lib/stellar.ts` as you no longer need the Horizon or Soroban RPC setup (Wagmi handles RPC connections via its config). Ensure you remove any imports pointing to it.
