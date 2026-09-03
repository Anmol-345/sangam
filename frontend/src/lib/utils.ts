import { formatEther } from 'viem';

export function shortenAddress(address: string | null | undefined): string {
  if (!address) return "";
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function stroopsToDisplay(weiAmount: number | bigint | string | undefined): string {
  if (weiAmount === undefined || weiAmount === null) return "0.00";
  try {
    const amount = BigInt(weiAmount);
    return Number(formatEther(amount)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return "0.00";
  }
}
