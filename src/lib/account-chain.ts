import type { ApiPromise } from "@polkadot/api";
import { decodeAddress } from "@polkadot/util-crypto";
import { u8aEq } from "@polkadot/util";
import { getChainApi } from "./chain-api";
import { parseTrackVoting } from "./conviction-voting";
import { parseReferendumOutcome, parseVotingExtras, refundableDeposit, refundableDeposits, voteUnlockAt, type DepositKind, type ReferendumOutcome, type TrackState } from "./account-voting";

type Json = { toJSON: () => unknown };
type Chain = { rpc: string; genesisHash: `0x${string}` };

/** Same account regardless of SS58 prefix. */
export function sameAccount(a: string, b: string) {
  try {
    return u8aEq(decodeAddress(a), decodeAddress(b));
  } catch {
    return a === b;
  }
}

export function trackNamesFromConsts(api: ApiPromise) {
  const tracks = api.consts.referenda?.tracks?.toJSON() as unknown;
  const names = new Map<number, string>();
  if (!Array.isArray(tracks)) return names;
  for (const track of tracks) {
    if (!Array.isArray(track)) continue;
    const raw = String((track[1] as { name?: unknown } | undefined)?.name ?? "");
    const text = /^0x[0-9a-f]*$/i.test(raw) ? (raw.slice(2).match(/../g) ?? []).map((b) => String.fromCharCode(Number.parseInt(b, 16))).join("") : raw;
    names.set(Number(track[0]), text.replace(/\0+$/, "").replaceAll("_", " "));
  }
  return names;
}

/**
 * Block number on the clock OpenGov uses. Asset Hub governance runs on the relay chain's block numbers after the
 * migration, so prefer the last relay block the parachain saw and fall back to the local block number.
 */
export async function governanceBlockNumber(api: Pick<ApiPromise, "query">): Promise<number> {
  const relay = api.query.parachainSystem?.lastRelayChainBlockNumber;
  if (relay) {
    const value = Number((await relay() as unknown as Json).toJSON());
    if (value > 0) return value;
  }
  return Number((await api.query.system.number() as unknown as Json).toJSON());
}

export async function readReferendumOutcomes(api: ApiPromise, ids: number[]) {
  const unique = [...new Set(ids)];
  const infos = unique.length ? await api.query.referenda.referendumInfoFor.multi(unique) as unknown as Json[] : [];
  return new Map<number, ReferendumOutcome>(unique.map((id, index) => [id, parseReferendumOutcome(infos[index]?.toJSON())]));
}

export type AccountVotingSnapshot = {
  now: number;
  voteLockingPeriod: number;
  trackNames: Map<number, string>;
  tracks: (TrackState & { trackName: string; received: { votes: bigint; capital: bigint } })[];
};

/** Every vote, class lock, prior lock and received delegation of `address`, read from `convictionVoting`. */
export async function readAccountVoting({ rpc, genesisHash, address }: Chain & { address: string }): Promise<AccountVotingSnapshot> {
  const api = await getChainApi(rpc, genesisHash);
  if (!api.query.convictionVoting?.votingFor) throw new Error("This network does not support conviction voting");
  const [entries, locks, now] = await Promise.all([
    api.query.convictionVoting.votingFor.entries(address) as unknown as Promise<[{ args: [unknown, { toString: () => string }] }, Json][]>,
    api.query.convictionVoting.classLocksFor(address) as unknown as Promise<Json>,
    governanceBlockNumber(api),
  ]);
  const voteLockingPeriod = Number((api.consts.convictionVoting?.voteLockingPeriod as unknown as Json | undefined)?.toJSON() ?? 0);
  const names = trackNamesFromConsts(api);
  const lockByTrack = new Map<number, bigint>();
  const rawLocks = locks.toJSON();
  if (Array.isArray(rawLocks)) for (const item of rawLocks) if (Array.isArray(item)) lockByTrack.set(Number(item[0]), BigInt(String(item[1] ?? 0)));

  const parsed = entries.map(([key, value]) => {
    const json = value.toJSON();
    return { trackId: Number(key.args[1].toString()), voting: parseTrackVoting(json), extras: parseVotingExtras(json) };
  });
  const ids = parsed.flatMap((item) => item.voting.kind === "casting" ? [...item.voting.votes.keys()] : []);
  const outcomes = await readReferendumOutcomes(api, ids);
  const trackIds = new Set([...parsed.map((item) => item.trackId), ...lockByTrack.keys()]);
  const tracks = [...trackIds].sort((a, b) => a - b).map((trackId) => {
    const item = parsed.find((entry) => entry.trackId === trackId);
    const votes = item?.voting.kind === "casting"
      ? [...item.voting.votes.entries()].map(([referendumId, vote]) => {
          const outcome = outcomes.get(referendumId) ?? { state: "unknown" as const };
          return { referendumId, vote, outcome, unlockAt: voteUnlockAt(vote, outcome, voteLockingPeriod) };
        }).sort((a, b) => b.referendumId - a.referendumId)
      : [];
    return {
      trackId,
      trackName: names.get(trackId) || `Track ${trackId}`,
      lock: lockByTrack.get(trackId) ?? BigInt(0),
      votes,
      prior: item?.extras.prior && item.extras.prior.amount > BigInt(0) ? item.extras.prior : null,
      delegated: item?.voting.kind === "delegating" ? item.voting.balance : BigInt(0),
      received: item?.extras.delegations ?? { votes: BigInt(0), capital: BigInt(0) },
    };
  });
  return { now, voteLockingPeriod, trackNames: names, tracks };
}

/** Builds a refund only if the deposit is still held and eligible immediately before signing. */
export async function buildDepositRefund(api: ApiPromise, referendumId: number, kind: DepositKind, depositor?: string) {
  const outcome = (await readReferendumOutcomes(api, [referendumId])).get(referendumId);
  const entry = outcome && refundableDeposit(outcome, kind);
  if (!entry) throw new Error("This deposit is no longer refundable. Refresh the referendum for its current status.");
  if (depositor && !sameAccount(entry.who, depositor)) throw new Error("The deposit does not belong to this account.");

  return kind === "submission"
    ? api.tx.referenda.refundSubmissionDeposit(referendumId)
    : api.tx.referenda.refundDecisionDeposit(referendumId);
}

/** Refundable deposits of `address` on the given referenda, read from `referenda.referendumInfoFor`. */
export async function readRefundableDeposits({ rpc, genesisHash, address, referendumIds }: Chain & { address: string; referendumIds: number[] }) {
  const api = await getChainApi(rpc, genesisHash);
  const outcomes = await readReferendumOutcomes(api, referendumIds);
  return [...outcomes.entries()].flatMap(([referendumId, outcome]) =>
    refundableDeposits(outcome, address, sameAccount).map((item) => ({ referendumId, state: outcome.state, ...item })));
}
