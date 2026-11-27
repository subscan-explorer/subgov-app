import type { Vote } from "./types";

function tokenAmount(planck: bigint, decimals: number): string {
  if (planck === BigInt(0)) return "0";
  const base = BigInt(10) ** BigInt(decimals);
  const whole = planck / base;
  const frac = planck % base;
  if (frac === BigInt(0)) return whole.toString();
  return `${whole}.${frac.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

/**
 * Whether a referendum row has a tally to draw.
 *
 * The referenda list returns `approval_rate` and omits aye/nay amounts. A rate of 0
 * is still a tally: the ratio can truncate to 0.00, or nobody has voted yet.
 * Detail rows include token amounts, which also count when the rate is absent.
 * "No votes" is reserved for a payload that has neither.
 */
export function hasReferendumTally(row: {
  aye?: string | null;
  nay?: string | null;
  approval?: number | null;
}): boolean {
  const aye = Number(row.aye ?? 0);
  const nay = Number(row.nay ?? 0);
  if ((Number.isFinite(aye) && aye > 0) || (Number.isFinite(nay) && nay > 0)) return true;
  return typeof row.approval === "number" && Number.isFinite(row.approval);
}

/** Aye/Nay in the tally are conviction-weighted; Support is raw capital. */
export const TALLY_VOTING_POWER_HINT =
  "Aye and Nay are conviction-weighted voting power. A 100 PAS vote at 6× counts as 600. Split and 0.1× votes count as one-tenth of the amount. Support is the raw capital, including abstain.";

export const TALLY_SUPPORT_HINT = "Raw capital voted or locked, including abstain. This is not conviction-weighted.";

export type ChainTally = {
  ayes: bigint;
  nays: bigint;
  support: bigint;
};

export type ReferendumTallyView = {
  aye: string | null;
  nay: string | null;
  supportAmount: string | null;
  approval: number | null;
};

/** Parses a pallet balance from `toJSON()` (decimal string, hex, or a safe integer). */
export function planckFromChain(value: unknown): bigint | null {
  if (typeof value === "bigint") return value >= BigInt(0) ? value : null;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return BigInt(value);
  }
  if (typeof value !== "string") return null;
  const raw = value.replaceAll(",", "").replaceAll("_", "").trim();
  if (!raw) return null;
  try {
    if (/^0x[0-9a-f]+$/i.test(raw)) return BigInt(raw);
    if (/^\d+$/.test(raw)) return BigInt(raw);
  } catch {
    return null;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function pick(value: Record<string, unknown> | null, ...names: string[]): unknown {
  if (!value) return undefined;
  for (const name of names) {
    if (name in value) return value[name];
    const found = Object.entries(value).find(([key]) => key.toLowerCase() === name.toLowerCase());
    if (found) return found[1];
  }
  return undefined;
}

/** Reads the Ongoing tally out of `referenda.referendumInfoFor` JSON. Other statuses have no live tally. */
export function parseOnChainReferendumTally(info: unknown): ChainTally | null {
  const ongoing = asRecord(pick(asRecord(info), "ongoing"));
  const tally = asRecord(pick(ongoing, "tally"));
  if (!tally) return null;
  const ayes = planckFromChain(pick(tally, "ayes"));
  const nays = planckFromChain(pick(tally, "nays"));
  const support = planckFromChain(pick(tally, "support"));
  if (ayes == null || nays == null || support == null) return null;
  return { ayes, nays, support };
}

export function approvalFromWeightedVotes(ayes: bigint, nays: bigint): number | null {
  const total = ayes + nays;
  if (total <= BigInt(0)) return null;
  return Number((ayes * BigInt(10_000)) / total) / 100;
}

export function formatTallyView(tally: ChainTally, decimals: number): ReferendumTallyView {
  return {
    aye: tokenAmount(tally.ayes, decimals),
    nay: tokenAmount(tally.nays, decimals),
    supportAmount: tokenAmount(tally.support, decimals),
    approval: approvalFromWeightedVotes(tally.ayes, tally.nays),
  };
}

export function governanceInclusionPhase(progress: string): "inBlock" | "finalized" | null {
  if (progress === "Finalized") return "finalized";
  if (progress.startsWith("In block")) return "inBlock";
  return null;
}

/** Sum of abstain legs on the visible list. Incomplete pages may undercount. */
export function abstainAmountFromVotes(votes: Vote[], decimals: number): string | null {
  let total = BigInt(0);
  let seen = false;
  for (const vote of votes) {
    if (vote.side !== "Abstain") continue;
    const amount = planckFromChain(vote.amount);
    if (amount == null) continue;
    total += amount;
    seen = true;
  }
  if (!seen) return null;
  return tokenAmount(total, decimals);
}
