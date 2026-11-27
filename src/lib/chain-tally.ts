import { getChainApi } from "@/lib/chain-api";
import { parseTrackVoting, voteRowsFromExisting, type ExistingVote } from "@/lib/conviction-voting";
import { formatTallyView, parseOnChainReferendumTally, type ReferendumTallyView } from "@/lib/referendum-tally";
import type { Vote } from "@/lib/types";

/** Live `referenda.referendumInfoFor` tally. Returns null when the referendum is no longer ongoing. */
export async function readReferendumTally({
  rpc,
  genesisHash,
  referendumId,
  decimals,
}: {
  rpc: string;
  genesisHash: `0x${string}`;
  referendumId: number;
  decimals: number;
}): Promise<ReferendumTallyView | null> {
  const api = await getChainApi(rpc, genesisHash);
  if (!api.query.referenda?.referendumInfoFor) return null;
  const info = await api.query.referenda.referendumInfoFor(referendumId);
  const tally = parseOnChainReferendumTally(info.toJSON());
  return tally ? formatTallyView(tally, decimals) : null;
}

/** The account's current vote on one referendum, as vote-table rows. Empty if they are delegating or have no vote. */
export async function readAccountReferendumVotes({
  rpc,
  genesisHash,
  address,
  trackId,
  referendumId,
  at,
  extrinsicIndex,
}: {
  rpc: string;
  genesisHash: `0x${string}`;
  address: string;
  trackId: number;
  referendumId: number;
  at?: string;
  extrinsicIndex?: string;
}): Promise<Vote[]> {
  const api = await getChainApi(rpc, genesisHash);
  if (!api.query.convictionVoting?.votingFor) return [];
  const voting = await api.query.convictionVoting.votingFor(address, trackId);
  const parsed = parseTrackVoting(voting.toJSON());
  if (parsed.kind !== "casting") return [];
  const existing: ExistingVote | undefined = parsed.votes.get(referendumId);
  if (!existing) return [];
  // Current storage has no cast timestamp; never display the read time as the vote time.
  return voteRowsFromExisting(existing, { voter: address, at, extrinsicIndex });
}
