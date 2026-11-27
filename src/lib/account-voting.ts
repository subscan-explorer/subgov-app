import type { ConvictionName, ExistingVote } from "./conviction-voting";

/** Pure helpers for the "My votes" page: referendum outcome, lock expiry and the unlock plan. */

export type ReferendumOutcome =
  | { state: "ongoing" }
  | { state: "approved" | "rejected" | "cancelled" | "timedOut"; end: number; submissionDeposit: Deposit | null; decisionDeposit: Deposit | null }
  | { state: "killed"; end: number }
  | { state: "unknown" };

export type Deposit = { who: string; amount: bigint };
export type DepositKind = "submission" | "decision";

const LOCK_PERIODS: Record<ConvictionName, number> = {
  None: 0, Locked1x: 1, Locked2x: 2, Locked3x: 4, Locked4x: 8, Locked5x: 16, Locked6x: 32,
};

export function convictionLockPeriods(conviction: ConvictionName) {
  return LOCK_PERIODS[conviction] ?? 0;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function big(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^(0x[0-9a-f]+|\d+)$/i.test(value)) return BigInt(value);
  return BigInt(0);
}

function deposit(value: unknown): Deposit | null {
  const item = record(value);
  if (!item || typeof item.who !== "string") return null;
  return { who: item.who, amount: big(item.amount) };
}

/** Normalizes `referenda.referendumInfoFor(id)` JSON (`{ ongoing }`, `{ approved: [end, sub, dec] }`, `{ killed: end }`). */
export function parseReferendumOutcome(json: unknown): ReferendumOutcome {
  const value = record(json);
  if (!value) return { state: "unknown" };
  const key = Object.keys(value)[0]?.toLowerCase();
  const body = Object.values(value)[0];
  if (key === "ongoing") return { state: "ongoing" };
  if (key === "killed") return { state: "killed", end: Number(big(body)) };
  const state = ({ approved: "approved", rejected: "rejected", cancelled: "cancelled", timedout: "timedOut" } as const)[key as "approved"];
  if (!state || !Array.isArray(body)) return { state: "unknown" };
  return { state, end: Number(big(body[0])), submissionDeposit: deposit(body[1]), decisionDeposit: deposit(body[2]) };
}

/**
 * Block after which removing this vote frees its balance, following `pallet-conviction-voting::remove_vote`:
 * only a Standard vote on the winning side of an approved/rejected referendum keeps a conviction lock.
 * Zero means no post-vote lock; do not compare historical end blocks from a different clock.
 * Null while the referendum is ongoing or its state is unknown.
 */
export function voteUnlockAt(vote: ExistingVote, outcome: ReferendumOutcome, voteLockingPeriod: number): number | null {
  if (outcome.state === "ongoing" || outcome.state === "unknown") return null;
  if (outcome.state !== "approved" && outcome.state !== "rejected") return 0;
  if (!("conviction" in vote) || vote.conviction === "None") return 0;
  const won = (vote.mode === "Aye") === (outcome.state === "approved");
  return won ? outcome.end + convictionLockPeriods(vote.conviction) * voteLockingPeriod : 0;
}

export function voteBalance(vote: ExistingVote): bigint {
  if ("balance" in vote) return vote.balance;
  return vote.aye + vote.nay + ("abstain" in vote ? vote.abstain : BigInt(0));
}

export type TrackVote = { referendumId: number; vote: ExistingVote; outcome: ReferendumOutcome; unlockAt: number | null };
export type TrackState = {
  trackId: number;
  lock: bigint;
  votes: TrackVote[];
  /** `casting.prior`: balance still locked from removed votes, until `unlockAt`. */
  prior: { unlockAt: number; amount: bigint } | null;
  /** Balance locked by an active delegation on this track. */
  delegated: bigint;
};

export type UnlockPlan = {
  /** Votes whose lock has expired; `removeVote` them before `unlock`. */
  remove: { trackId: number; referendumId: number }[];
  /** Tracks to call `unlock(class, target)` on. */
  unlock: number[];
  /** Estimated balance released across all tracks (the account lock is the max over tracks). */
  releasable: bigint;
  /** Overall conviction-voting lock before and after the plan. */
  lockedBefore: bigint;
  lockedAfter: bigint;
};

const max = (values: bigint[]) => values.reduce((a, b) => (a > b ? a : b), BigInt(0));

/** Which votes can be removed and which track locks can be lowered at `now` (in the governance block clock). */
export function unlockPlan(tracks: TrackState[], now: number): UnlockPlan {
  const remove: UnlockPlan["remove"] = [];
  const unlock: number[] = [];
  const after: bigint[] = [];
  for (const track of tracks) {
    const expired = track.votes.filter((item) => item.unlockAt != null && item.unlockAt <= now);
    const remaining = track.votes.filter((item) => !expired.includes(item));
    const priorActive = track.prior && track.prior.unlockAt > now ? track.prior.amount : BigInt(0);
    // Removing an expired vote with a pending lock would move it into `prior`; expired ones add nothing.
    const stillLocked = max([priorActive, track.delegated, ...remaining.map((item) => voteBalance(item.vote))]);
    const next = stillLocked < track.lock ? stillLocked : track.lock;
    after.push(next);
    for (const item of expired) remove.push({ trackId: track.trackId, referendumId: item.referendumId });
    if (next < track.lock) unlock.push(track.trackId);
  }
  const lockedBefore = max(tracks.map((track) => track.lock));
  const lockedAfter = max(after);
  return { remove, unlock, releasable: lockedBefore - lockedAfter, lockedBefore, lockedAfter };
}

/** Returns the deposit the runtime can currently refund for this referendum and kind. */
export function refundableDeposit(outcome: ReferendumOutcome, kind: DepositKind): Deposit | null {
  if (!("submissionDeposit" in outcome)) return null;
  if (kind === "decision") return outcome.decisionDeposit;
  return outcome.state === "approved" || outcome.state === "cancelled" ? outcome.submissionDeposit : null;
}

/** Refundable referendum deposits for `account`, from one referendum's on-chain info. */
export function refundableDeposits(outcome: ReferendumOutcome, account: string, sameAccount: (a: string, b: string) => boolean = (a, b) => a === b) {
  return (["submission", "decision"] as const).flatMap((kind) => {
    const entry = refundableDeposit(outcome, kind);
    return entry && sameAccount(entry.who, account) ? [{ kind, amount: entry.amount }] : [];
  });
}

/** Reads the prior lock and received delegations shared by both `votingFor` variants. */
export function parseVotingExtras(json: unknown) {
  const voting = record(json);
  const state = record(voting?.casting) ?? record(voting?.delegating);
  const prior = Array.isArray(state?.prior) ? state.prior : null;
  const delegations = record(state?.delegations);
  return {
    prior: prior ? { unlockAt: Number(big(prior[0])), amount: big(prior[1]) } : null,
    delegations: { votes: big(delegations?.votes), capital: big(delegations?.capital) },
  };
}
