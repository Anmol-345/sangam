import { parseAbi, decodeEventLog, type Address } from 'viem';
import { readContract, writeContract, waitForTransactionReceipt } from '@wagmi/core';
import { config as wagmiConfig } from '@/components/wallet/WalletProvider';

export const CONTRACT_ID = (process.env.NEXT_PUBLIC_CONTRACT_ID as Address) || '0x0000000000000000000000000000000000000000';

export const CHITFUND_ABI = parseAbi([
    "struct FundConfig { address organizer; uint256 contribution; uint32 memberCount; string name; }",
    "struct FundSummary { FundConfig config; uint8 state; uint32 currentRound; address[] members; address[] pastWinners; }",
    "function createFund(string _name, uint256 _contribution, uint32 _memberCount) external returns (uint64)",
    "function joinFund(uint64 _fundId) external",
    "function activateFund(uint64 _fundId) external",
    "function deposit(uint64 _fundId) external payable",
    "function commitHash(uint64 _fundId, bytes32 _hash) external",
    "function revealHash(uint64 _fundId, bytes32 _secret) external",
    "function claimPot(uint64 _fundId) external",
    "function getFundSummary(uint64 _fundId) external view returns (FundSummary)",
    "function getRoundSummary(uint64 _fundId, uint32 _round) external view returns (uint32 deposits, uint32 commits, uint32 reveals)",
    "function getMemberStatus(uint64 _fundId, uint32 _round, address _member) external view returns (bool deposited, bool committed, bool revealed)",
    "event FundCreated(uint64 indexed fundId, address indexed organizer, string name)"
]);

export async function createChitFund(
  organizer: string,
  token: string, // Kept for signature compatibility, ignored internally
  name: string,
  contribution: bigint | number,
  memberCount: number
): Promise<number> {
  const hash = await writeContract(wagmiConfig, {
    address: CONTRACT_ID,
    abi: CHITFUND_ABI,
    functionName: 'createFund',
    args: [name, BigInt(contribution), memberCount],
  });
  
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  
  for (const log of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: CHITFUND_ABI,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === 'FundCreated') {
        return Number(decoded.args.fundId);
      }
    } catch (e) {
      // Ignore logs that don't match
    }
  }
  throw new Error("FundCreated event not found in receipt");
}

export async function joinFund(member: string, fundId: number) {
  const hash = await writeContract(wagmiConfig, {
    address: CONTRACT_ID,
    abi: CHITFUND_ABI,
    functionName: 'joinFund',
    args: [BigInt(fundId)],
  });
  return waitForTransactionReceipt(wagmiConfig, { hash });
}

export async function activateFund(organizer: string, fundId: number) {
  const hash = await writeContract(wagmiConfig, {
    address: CONTRACT_ID,
    abi: CHITFUND_ABI,
    functionName: 'activateFund',
    args: [BigInt(fundId)],
  });
  return waitForTransactionReceipt(wagmiConfig, { hash });
}

export async function deposit(member: string, fundId: number, amount: bigint | number) {
  const hash = await writeContract(wagmiConfig, {
    address: CONTRACT_ID,
    abi: CHITFUND_ABI,
    functionName: 'deposit',
    args: [BigInt(fundId)],
    value: BigInt(amount),
  });
  return waitForTransactionReceipt(wagmiConfig, { hash });
}

export async function commitHash(member: string, fundId: number, hashHex: string) {
  const hash = await writeContract(wagmiConfig, {
    address: CONTRACT_ID,
    abi: CHITFUND_ABI,
    functionName: 'commitHash',
    args: [BigInt(fundId), `0x${hashHex}` as `0x${string}`],
  });
  return waitForTransactionReceipt(wagmiConfig, { hash });
}

export async function revealHash(member: string, fundId: number, secretHex: string) {
  const hash = await writeContract(wagmiConfig, {
    address: CONTRACT_ID,
    abi: CHITFUND_ABI,
    functionName: 'revealHash',
    args: [BigInt(fundId), `0x${secretHex}` as `0x${string}`],
  });
  return waitForTransactionReceipt(wagmiConfig, { hash });
}

export async function claimPot(winner: string, fundId: number) {
  const hash = await writeContract(wagmiConfig, {
    address: CONTRACT_ID,
    abi: CHITFUND_ABI,
    functionName: 'claimPot',
    args: [BigInt(fundId)],
  });
  return waitForTransactionReceipt(wagmiConfig, { hash });
}

export interface FundConfig {
  organizer: string;
  token: string;
  name: string;
  contribution: bigint;
  member_count: number;
}

export interface FundSummary {
  config: FundConfig;
  state: ['Pending' | 'Active' | 'Completed'];
  members: string[];
  current_round: number;
  past_winners: string[];
}

export function formatFundState(state: ['Pending' | 'Active' | 'Completed'] | number): string {
  if (typeof state === 'number') {
    if (state === 0) return "Pending";
    if (state === 1) return "Active";
    if (state === 2) return "Completed";
  }
  if (Array.isArray(state) && state.length > 0) return state[0];
  return "Unknown";
}

export async function getFundSummary(callerAddress: string, fundId: number): Promise<FundSummary | null> {
  try {
    const data = await readContract(wagmiConfig, {
      address: CONTRACT_ID,
      abi: CHITFUND_ABI,
      functionName: 'getFundSummary',
      args: [BigInt(fundId)],
    });

    if (!data.config.organizer || data.config.organizer === '0x0000000000000000000000000000000000000000') {
      return null;
    }
    
    return {
      config: {
        organizer: data.config.organizer,
        token: "Native BOT",
        name: data.config.name,
        contribution: BigInt(data.config.contribution),
        member_count: Number(data.config.memberCount),
      },
      state: data.state === 0 ? ['Pending'] : data.state === 1 ? ['Active'] : ['Completed'],
      current_round: Number(data.currentRound),
      members: [...data.members],
      past_winners: [...data.pastWinners],
    };
  } catch (e) {
    return null;
  }
}

export interface RoundSummary {
  deposit_count: number;
  commit_count: number;
  reveal_count: number;
}

export async function getRoundSummary(callerAddress: string, fundId: number, round: number): Promise<RoundSummary | null> {
  try {
    const data = await readContract(wagmiConfig, {
      address: CONTRACT_ID,
      abi: CHITFUND_ABI,
      functionName: 'getRoundSummary',
      args: [BigInt(fundId), round],
    });

    return {
      deposit_count: Number(data[0]),
      commit_count: Number(data[1]),
      reveal_count: Number(data[2]),
    };
  } catch (e) {
    return null;
  }
}

export interface MemberStatus {
  has_deposited: boolean;
  has_committed: boolean;
  has_revealed: boolean;
}

export async function getMemberStatus(
  callerAddress: string,
  fundId: number,
  member: string,
  round: number
): Promise<MemberStatus> {
  try {
    const data = await readContract(wagmiConfig, {
      address: CONTRACT_ID,
      abi: CHITFUND_ABI,
      functionName: 'getMemberStatus',
      args: [BigInt(fundId), round, member as Address],
    });

    return {
      has_deposited: data[0],
      has_committed: data[1],
      has_revealed: data[2],
    };
  } catch (e) {
    return { has_deposited: false, has_committed: false, has_revealed: false };
  }
}
