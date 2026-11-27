import type { Vote } from "./types";
import { decodeAddress } from "@polkadot/util-crypto";
import { u8aEq } from "@polkadot/util";

/** Pure helpers for OpenGov conviction-voting calls and on-chain voting state. */

export type VoteMode = "Aye" | "Nay" | "Split" | "Abstain";
export const VOTE_MODES: VoteMode[] = ["Aye", "Nay", "Split", "Abstain"];

/** Pallet conviction names, indexed by the `Vote` byte's low 7 bits. */
export const CONVICTION_NAMES = ["None", "Locked1x", "Locked2x", "Locked3x", "Locked4x", "Locked5x", "Locked6x"] as const;
export type ConvictionName = (typeof CONVICTION_NAMES)[number];

const ZERO = BigInt(0);

export type VoteAmounts = { amount?: string; aye?: string; nay?: string; abstain?: string };

export type ConvictionVote =
  | { Standard: { vote: { aye: boolean; conviction: ConvictionName }; balance: bigint } }
  | { Split: { aye: bigint; nay: bigint } }
  | { SplitAbstain: { aye: bigint; nay: bigint; abstain: bigint } };

/** Parses a token amount into planck. Empty input is zero only when `allowZero` is set. */
export function parseVoteAmount(value: string | undefined, decimals: number, label = "Amount", allowZero = false): bigint {
  const trimmed = (value ?? "").trim();
  if (!trimmed && allowZero) return ZERO;
  const match = trimmed.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) throw new Error(`${label}: enter a valid positive amount`);
  const fraction = match[2] ?? "";
  if (fraction.length > decimals && /[1-9]/.test(fraction.slice(decimals))) {
    throw new Error(`${label} supports at most ${decimals} decimal places`);
  }
  const planck = BigInt(match[1]) * BigInt(10) ** BigInt(decimals) + BigInt((fraction.slice(0, decimals) || "0").padEnd(decimals, "0"));
  if (planck <= ZERO && !allowZero) throw new Error(`${label} must be greater than zero`);
  return planck;
}

/** Builds the `AccountVote` argument for `convictionVoting.vote`. */
export function buildConvictionVote(mode: VoteMode, amounts: VoteAmounts, decimals: number, conviction: ConvictionName): ConvictionVote {
  if (mode === "Aye" || mode === "Nay") {
    return { Standard: { vote: { aye: mode === "Aye", conviction }, balance: parseVoteAmount(amounts.amount, decimals) } };
  }
  const aye = parseVoteAmount(amounts.aye, decimals, "Aye amount", true);
  const nay = parseVoteAmount(amounts.nay, decimals, "Nay amount", true);
  if (mode === "Split") {
    if (aye + nay <= ZERO) throw new Error("Enter an aye or nay amount for a split vote");
    return { Split: { aye, nay } };
  }
  return { SplitAbstain: { aye, nay, abstain: parseVoteAmount(amounts.abstain, decimals, "Abstain amount") } };
}

/** Balance the vote locks; the pallet caps it at the account's total balance. */
export function convictionVoteBalance(vote: ConvictionVote): bigint {
  if ("Standard" in vote) return vote.Standard.balance;
  if ("Split" in vote) return vote.Split.aye + vote.Split.nay;
  return vote.SplitAbstain.aye + vote.SplitAbstain.nay + vote.SplitAbstain.abstain;
}

export type ExistingVote =
  | { mode: "Aye" | "Nay"; conviction: ConvictionName; balance: bigint }
  | { mode: "Split"; aye: bigint; nay: bigint }
  | { mode: "Abstain"; aye: bigint; nay: bigint; abstain: bigint };

export type Delegation = { target: string; conviction: ConvictionName; balance: bigint };

export type TrackVoting =
  | { kind: "casting"; votes: Map<number, ExistingVote> }
  | ({ kind: "delegating" } & Delegation);

/** Checks that the delegation being signed still matches what the user reviewed. */
export function confirmDelegationChange(voting: TrackVoting, expected: Delegation | null): boolean {
  if (voting.kind === "casting" && expected === null) return false;
  if (voting.kind === "delegating" && expected !== null
    && voting.target === expected.target && voting.conviction === expected.conviction && voting.balance === expected.balance) return true;
  throw new Error("The delegation on this track changed. Review the current delegation before signing.");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function field(value: Record<string, unknown> | null, name: string): unknown {
  if (!value) return undefined;
  if (name in value) return value[name];
  const lower = name.toLowerCase();
  return Object.entries(value).find(([key]) => key.toLowerCase() === lower)?.[1];
}

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^(0x[0-9a-f]+|\d+)$/i.test(value.replaceAll(",", ""))) return BigInt(value.replaceAll(",", ""));
  return ZERO;
}

function convictionName(value: unknown): ConvictionName {
  if (typeof value === "number") return CONVICTION_NAMES[value] ?? "None";
  return CONVICTION_NAMES.find((name) => name.toLowerCase() === String(value).toLowerCase()) ?? "None";
}

/** Decodes the packed `Vote` byte (high bit aye, low 7 bits conviction). */
export function decodeVoteByte(value: unknown): { aye: boolean; conviction: ConvictionName } {
  const objectVote = record(value);
  if (objectVote) {
    const vote = field(objectVote, "vote");
    return { aye: vote === true || String(vote).toLowerCase() === "aye", conviction: convictionName(field(objectVote, "conviction")) };
  }
  const byte = typeof value === "number" ? value : Number.parseInt(String(value).replace(/^0x/i, ""), 16);
  if (!Number.isInteger(byte) || byte < 0 || byte > 255) throw new Error("Unrecognized on-chain vote");
  return { aye: (byte & 0x80) !== 0, conviction: CONVICTION_NAMES[byte & 0x7f] ?? "None" };
}

/** Normalizes one `AccountVote` from `convictionVoting.votingFor` JSON. */
export function parseAccountVote(json: unknown): ExistingVote | null {
  const value = record(json);
  const standard = record(field(value, "standard"));
  if (standard) {
    const vote = decodeVoteByte(field(standard, "vote"));
    return { mode: vote.aye ? "Aye" : "Nay", conviction: vote.conviction, balance: toBig(field(standard, "balance")) };
  }
  const split = record(field(value, "split"));
  if (split) return { mode: "Split", aye: toBig(field(split, "aye")), nay: toBig(field(split, "nay")) };
  const abstain = record(field(value, "splitAbstain"));
  if (abstain) return { mode: "Abstain", aye: toBig(field(abstain, "aye")), nay: toBig(field(abstain, "nay")), abstain: toBig(field(abstain, "abstain")) };
  return null;
}

/** Normalizes `convictionVoting.votingFor(account, class)` JSON. */
export function parseTrackVoting(json: unknown): TrackVoting {
  const value = record(json);
  const delegating = record(field(value, "delegating"));
  if (delegating) {
    return {
      kind: "delegating",
      target: String(field(delegating, "target") ?? ""),
      conviction: convictionName(field(delegating, "conviction")),
      balance: toBig(field(delegating, "balance")),
    };
  }
  const votes = new Map<number, ExistingVote>();
  const list = field(record(field(value, "casting")), "votes");
  if (Array.isArray(list)) {
    for (const entry of list) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const vote = parseAccountVote(entry[1]);
      const id = Number(toBig(entry[0]));
      if (vote && Number.isSafeInteger(id)) votes.set(id, vote);
    }
  }
  return { kind: "casting", votes };
}

/** Total balance the account can put behind a vote (pallet: `Currency::total_balance`). */
export function votableBalance(accountJson: unknown): bigint {
  const data = record(field(record(accountJson), "data"));
  return toBig(field(data, "free")) + toBig(field(data, "reserved"));
}

/** Lock held for one class in `convictionVoting.classLocksFor` JSON. */
export function classLock(locksJson: unknown, trackId: number): bigint {
  if (!Array.isArray(locksJson)) return ZERO;
  const entry = locksJson.find((item) => Array.isArray(item) && Number(toBig(item[0])) === trackId) as unknown[] | undefined;
  return entry ? toBig(entry[1]) : ZERO;
}

/**
 * Calls for undelegating one or more classes and optionally delegating again.
 * Returns the ordered list so callers can wrap more than one in `utility.batchAll`.
 */
export function delegationChangePlan(undelegateTracks: number[], delegate?: { trackId: number }) {
  const unique = [...new Set(undelegateTracks)];
  for (const track of unique) if (!Number.isSafeInteger(track) || track < 0) throw new Error("Select a valid OpenGov track");
  if (!unique.length && !delegate) throw new Error("Select at least one track to undelegate");
  return [
    ...unique.sort((a, b) => a - b).map((trackId) => ({ call: "undelegate" as const, trackId })),
    ...(delegate ? [{ call: "delegate" as const, trackId: delegate.trackId }] : []),
  ];
}

/** Reads the ballots for a referendum, including calls inside a proxy or utility batch. */
export function votesInExtrinsic(params: unknown, referendumId: number): ExistingVote[] {
  const ballots: ExistingVote[] = [];
  const pending = [params];
  while (pending.length) {
    const fields = pending.pop();
    if (!Array.isArray(fields)) continue;

    let poll: unknown;
    let ballot: unknown;
    for (const value of fields) {
      const param = record(value);
      if (!param) continue;
      switch (param.name) {
        case "poll_index":
        case "ref_index": poll = param.value; break;
        case "vote": ballot = param.value; break;
        case "call": pending.push(record(param.value)?.params); break;
        case "calls":
          if (Array.isArray(param.value)) {
            for (const call of param.value) pending.push(record(call)?.params);
          }
          break;
      }
    }

    if ((typeof poll !== "number" && typeof poll !== "string") || String(poll) !== String(referendumId)) continue;
    try {
      const vote = parseAccountVote(ballot);
      if (vote) ballots.push(vote);
    } catch {
      // A historical parameter may be missing or undecodable.
    }
  }
  return ballots;
}

/** Only directly cast votes with no conviction can be split. */
export function canBeSplitVote(vote: Vote): boolean {
  if (vote.delegated) return false;
  const multiplier = convictionMultiplier(vote.conviction);
  return vote.side === "Abstain" || multiplier === 0.1 || multiplier == null;
}

function matchesIndexedVote(vote: Vote, ballot: ExistingVote): boolean {
  const amount = toBig(vote.amount);
  if (amount <= ZERO) return false;
  if ("balance" in ballot) {
    const multiplier = convictionMultiplier(vote.conviction);
    return vote.side === ballot.mode && amount === ballot.balance
      && (multiplier == null || multiplier === convictionMultiplier(ballot.conviction));
  }
  if (vote.side === "Aye") return amount === ballot.aye;
  if (vote.side === "Nay") return amount === ballot.nay;
  return ballot.mode === "Abstain" && amount === ballot.abstain;
}

/** Labels each indexed row from its ballot so siblings on another page can carry the same type. */
export function markSplitVotes(votes: Vote[], ballotsFor: (vote: Vote) => ExistingVote[] | undefined): Vote[] {
  const key = (vote: Vote) => `${vote.relayChain ? "relay" : "hub"}|${vote.voter}|${vote.extrinsicIndex}`;
  const sidesByBallot = new Map<string, Set<Vote["side"]>>();
  for (const vote of votes) {
    if (!vote.extrinsicIndex || !canBeSplitVote(vote)) continue;
    const id = key(vote);
    const sides = sidesByBallot.get(id) ?? new Set<Vote["side"]>();
    sides.add(vote.side);
    sidesByBallot.set(id, sides);
  }

  return votes.map((vote) => {
    if (!canBeSplitVote(vote)) return vote;
    if (vote.side === "Abstain") return { ...vote, split: "SplitAbstain" };

    const matches = ballotsFor(vote)?.filter((ballot) => matchesIndexedVote(vote, ballot)) ?? [];
    if (matches.length) {
      const mode = matches[0].mode;
      if (!matches.every((ballot) => ballot.mode === mode)) return vote;
      if (mode === "Split" || mode === "Abstain") return { ...vote, split: mode === "Split" ? "Split" : "SplitAbstain" };
      return vote;
    }

    // Preserve labels that can be inferred when the original extrinsic is unavailable.
    const sides = vote.extrinsicIndex ? sidesByBallot.get(key(vote)) : undefined;
    if (sides?.has("Abstain")) return { ...vote, split: "SplitAbstain" };
    if (sides?.has("Aye") && sides.has("Nay")) return { ...vote, split: "Split" };
    return vote;
  });
}

/** Conviction multipliers used for standard aye/nay voting power. None / 0x is 0.1. */
export function convictionMultiplier(conviction: string | number | undefined | null): number | null {
  if (conviction == null || conviction === "") return null;
  if (typeof conviction === "number") {
    if (!Number.isFinite(conviction)) return null;
    if (conviction === 0) return 0.1;
    return conviction;
  }
  const value = conviction.trim().toLowerCase();
  if (!value || value === "—" || value === "-" || value === "–") return null;
  if (value === "none" || value === "0x" || value === "0.1x" || value === "0") return 0.1;
  const locked = value.match(/^locked([1-6])x$/);
  if (locked) return Number(locked[1]);
  const labelled = value.match(/^(\d+(?:\.\d+)?)x$/);
  if (labelled) {
    const n = Number(labelled[1]);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n === 0) return 0.1;
  return n;
}

/**
 * Voting power in planck, following OpenGov / Subsquare:
 * standard aye/nay is amount × conviction (None/0x = 0.1x);
 * split aye/nay parts are always 0.1x;
 * abstain (including a SplitAbstain abstain part) has no conviction and
 * is counted at face value toward support.
 */
export function voteVotingPower(vote: Pick<Vote, "amount" | "conviction" | "side"> & { split?: Vote["split"] }): bigint | null {
  try {
    const amount = BigInt(String(vote.amount).replaceAll("_", ""));
    if (amount < BigInt(0)) return null;
    if (vote.side === "Abstain") return amount;
    if (vote.split === "Split" || vote.split === "SplitAbstain") return amount / BigInt(10);
    const multiplier = convictionMultiplier(vote.conviction);
    if (multiplier == null) return null;
    if (multiplier === 0.1) return amount / BigInt(10);
    if (Number.isInteger(multiplier) && multiplier >= 1 && multiplier <= 6) return amount * BigInt(multiplier);
    return null;
  } catch {
    return null;
  }
}


function convictionLabel(name: ConvictionName): string {
  return name === "None" ? "0.1x" : name.replace(/^Locked/, "");
}

/** Turns an on-chain `AccountVote` into the rows the vote table renders, including split legs. */
export function voteRowsFromExisting(vote: ExistingVote, meta: { voter: string; at?: string; extrinsicIndex?: string }): Vote[] {
  const base = {
    voter: meta.voter,
    at: meta.at ?? "",
    ...(meta.extrinsicIndex ? { extrinsicIndex: meta.extrinsicIndex } : {}),
  };
  if ("balance" in vote) {
    return [{ ...base, side: vote.mode, amount: vote.balance.toString(), conviction: convictionLabel(vote.conviction) }];
  }
  const split = vote.mode === "Split" ? "Split" as const : "SplitAbstain" as const;
  const rows: Vote[] = [];
  if (vote.aye > ZERO) rows.push({ ...base, side: "Aye", amount: vote.aye.toString(), conviction: "0.1x", split });
  if (vote.nay > ZERO) rows.push({ ...base, side: "Nay", amount: vote.nay.toString(), conviction: "0.1x", split });
  if (vote.mode === "Abstain" && vote.abstain > ZERO) {
    rows.push({ ...base, side: "Abstain", amount: vote.abstain.toString(), conviction: "—", split: "SplitAbstain" });
  }
  return rows;
}

/** Replaces every current row for one account, keeping other voters in their existing order. */
export function replaceAccountVotes(votes: Vote[], voter: string, next: Vote[]): Vote[] {
  const others = votes.filter((vote) => {
    try { return !u8aEq(decodeAddress(vote.voter), decodeAddress(voter)); }
    catch { return vote.voter !== voter; }
  });
  return [...next, ...others];
}
