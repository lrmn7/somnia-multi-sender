import { isAddress, parseUnits, formatUnits } from "viem";

export interface RecipientEntry {
  address: string;
  amount: string; // token display units (e.g. "1.5")
  baseUnits: string; // base units in wei (e.g. "1500000000000000000")
}

export interface RandomParams {
  totalAmountStr: string;
  recipientAddresses: string[];
  minAmountStr?: string;
  maxAmountStr?: string;
  decimals: number;
}

export interface RandomResult {
  entries: RecipientEntry[];
  stats: {
    min: string;
    max: string;
    avg: string;
    total: string;
  };
}

/**
 * Calculates equal distribution amounts with exact remainder reconciliation.
 * Post-condition: sum(entries.baseUnits) === totalBaseUnits exactly.
 */
export function calculateEqualDistribution(
  totalAmountStr: string,
  recipientAddresses: string[],
  decimals = 18
): { entries: RecipientEntry[]; remainderBaseUnits: bigint } {
  if (recipientAddresses.length === 0 || !totalAmountStr) {
    return { entries: [], remainderBaseUnits: 0n };
  }

  const totalBaseUnits = parseUnits(totalAmountStr, decimals);
  const count = BigInt(recipientAddresses.length);
  if (count === 0n) return { entries: [], remainderBaseUnits: 0n };

  const amountPerRecipientBase = totalBaseUnits / count;
  const remainder = totalBaseUnits % count;

  const entries: RecipientEntry[] = recipientAddresses.map((addr, index) => {
    // Exact division: if there is a remainder, add 1 base unit to the first `remainder` recipients
    const finalAmountBase = index < Number(remainder) ? amountPerRecipientBase + 1n : amountPerRecipientBase;

    return {
      address: addr.trim(),
      amount: formatUnits(finalAmountBase, decimals),
      baseUnits: finalAmountBase.toString(),
    };
  });

  return { entries, remainderBaseUnits: remainder };
}

/**
 * Generates bounded random distribution with strict invariant verification:
 * Invariant 1: sum(amounts) === totalBase
 * Invariant 2: for every i: minBase <= amounts[i] <= maxBase
 *
 * NOTE: This uses client-side pseudo-random entropy (Math.random) for UI ergonomics.
 * It is NOT provably fair and must not be claimed as cryptographic randomness.
 */
export function generateBoundedRandomDistribution(params: RandomParams): RandomResult {
  const { totalAmountStr, recipientAddresses, minAmountStr, maxAmountStr, decimals } = params;
  const count = recipientAddresses.length;

  if (count === 0 || !totalAmountStr) {
    return {
      entries: [],
      stats: { min: "0", max: "0", avg: "0", total: "0" },
    };
  }

  const totalBase = parseUnits(totalAmountStr, decimals);
  const minBase = minAmountStr ? parseUnits(minAmountStr, decimals) : 1n;
  const maxBase = maxAmountStr ? parseUnits(maxAmountStr, decimals) : totalBase;

  if (minBase > maxBase) {
    throw new Error(
      `Minimum amount (${formatUnits(minBase, decimals)}) cannot exceed maximum amount (${formatUnits(maxBase, decimals)})`
    );
  }

  const countBigInt = BigInt(count);
  if (minBase * countBigInt > totalBase) {
    throw new Error(
      `Minimum amount (${formatUnits(minBase, decimals)}) x ${count} recipients exceeds total pool (${formatUnits(totalBase, decimals)})`
    );
  }

  if (maxBase * countBigInt < totalBase) {
    throw new Error(
      `Maximum amount (${formatUnits(maxBase, decimals)}) x ${count} recipients is less than total pool (${formatUnits(totalBase, decimals)})`
    );
  }

  // Pre-allocate minimum amount to all recipients
  const assigned: bigint[] = new Array(count).fill(minBase);
  let remaining = totalBase - minBase * countBigInt;
  const capacityPerRecipient = maxBase - minBase;

  // Distribute remaining amount pseudo-randomly within [minBase, maxBase] bounds
  if (remaining > 0n && capacityPerRecipient > 0n) {
    const weights: number[] = [];
    let totalWeight = 0;
    for (let i = 0; i < count; i++) {
      const w = Math.random() + 0.01;
      weights.push(w);
      totalWeight += w;
    }

    for (let i = 0; i < count; i++) {
      if (remaining === 0n) break;
      const proportion = weights[i] / totalWeight;
      let share = BigInt(Math.floor(Number(remaining) * proportion));
      if (share > capacityPerRecipient) {
        share = capacityPerRecipient;
      }
      if (share > remaining) {
        share = remaining;
      }
      assigned[i] += share;
      remaining -= share;
    }

    // Distribute any leftover base units without exceeding maxBase
    let pass = 0;
    while (remaining > 0n && pass < count * 2) {
      const idx = pass % count;
      if (assigned[idx] < maxBase) {
        const canAdd = maxBase - assigned[idx];
        const toAdd = remaining < canAdd ? remaining : canAdd;
        assigned[idx] += toAdd;
        remaining -= toAdd;
      }
      pass++;
    }
  }

  // Verify Invariant 1: sum === total
  let sum = 0n;
  let actualMin = assigned[0];
  let actualMax = assigned[0];

  for (let i = 0; i < count; i++) {
    const val = assigned[i];
    sum += val;
    if (val < actualMin) actualMin = val;
    if (val > actualMax) actualMax = val;

    // Verify Invariant 2: minBase <= val <= maxBase
    if (val < minBase || val > maxBase) {
      throw new Error(
        `Invariant violation: Recipient #${i + 1} allocated ${formatUnits(val, decimals)} outside bounds [${formatUnits(minBase, decimals)}, ${formatUnits(maxBase, decimals)}]`
      );
    }
  }

  if (sum !== totalBase) {
    throw new Error(
      `Invariant violation: Sum of distribution (${formatUnits(sum, decimals)}) does not match requested total (${formatUnits(totalBase, decimals)})`
    );
  }

  const entries: RecipientEntry[] = recipientAddresses.map((addr, i) => ({
    address: addr.trim(),
    amount: formatUnits(assigned[i], decimals),
    baseUnits: assigned[i].toString(),
  }));

  const avgBase = sum / countBigInt;

  return {
    entries,
    stats: {
      min: formatUnits(actualMin, decimals),
      max: formatUnits(actualMax, decimals),
      avg: formatUnits(avgBase, decimals),
      total: formatUnits(sum, decimals),
    },
  };
}
