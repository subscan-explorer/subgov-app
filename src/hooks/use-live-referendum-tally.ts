"use client";

import { preconnectChainApi } from "@/lib/chain-api";
import { readAccountReferendumVotes, readReferendumTally } from "@/lib/chain-tally";
import { replaceAccountVotes } from "@/lib/conviction-voting";
import { subscribeGovernanceChanged } from "@/lib/governance-sync";
import { abstainAmountFromVotes, type ReferendumTallyView } from "@/lib/referendum-tally";
import type { Vote } from "@/lib/types";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type InitialTally = ReferendumTallyView & { abstain?: string | null };

/**
 * Prefers the on-chain referendum tally over the Subscan-backed server payload,
 * which can stay stale for the duration of the Next.js / Subscan cache.
 */
export function useLiveReferendumTally({
  rpc,
  genesisHash,
  referendumId,
  trackId,
  decimals,
  voter,
  initial,
  initialVotes,
  initialVoteCount,
}: {
  rpc: string;
  genesisHash: `0x${string}`;
  referendumId: number;
  trackId: number;
  decimals: number;
  voter?: string | null;
  initial: InitialTally;
  initialVotes: Vote[];
  initialVoteCount?: number;
}) {
  const scope = useMemo(() => ({ rpc, genesisHash, referendumId, trackId, decimals, voter }), [rpc, genesisHash, referendumId, trackId, decimals, voter]);
  const active = useRef(scope);
  active.current = scope;
  const [tallyState, setTally] = useState<{ scope: object; value: ReferendumTallyView | null } | null>(null);
  const [overrideState, setOverride] = useState<{ scope: object; voter: string; rows: Vote[] } | null>(null);
  const [errorState, setError] = useState<{ scope: object; message: string } | null>(null);
  const tally = tallyState?.scope === scope ? tallyState.value : null;
  const override = overrideState?.scope === scope ? overrideState : null;
  const error = errorState?.scope === scope ? errorState.message : null;
  const request = useRef(0);
  const voteRequest = useRef(0);
  const live = tally != null;

  const refreshTally = useCallback(async () => {
    const id = ++request.current;
    try {
      const next = await readReferendumTally({ rpc, genesisHash, referendumId, decimals });
      if (id !== request.current || active.current !== scope) return;
      setTally({ scope, value: next });
      setError(null);
    } catch (loadError) {
      if (id !== request.current || active.current !== scope) return;
      setError({ scope, message: loadError instanceof Error ? loadError.message : "Could not read the on-chain tally" });
    }
  }, [rpc, genesisHash, referendumId, decimals, scope]);

  const refreshAccountVotes = useCallback(async (voter: string, extrinsicIndex?: string) => {
    const id = ++voteRequest.current;
    try {
      const rows = await readAccountReferendumVotes({
        rpc,
        genesisHash,
        address: voter,
        trackId,
        referendumId,
        extrinsicIndex,
      });
      if (id === voteRequest.current && active.current === scope) setOverride({ scope, voter, rows });
    } catch {
      // The tally refresh is the source of truth; the list can catch up later.
    }
  }, [rpc, genesisHash, trackId, referendumId, scope]);

  useEffect(() => {
    preconnectChainApi(rpc, genesisHash);
    void refreshTally();
    if (voter) void refreshAccountVotes(voter);
  }, [rpc, genesisHash, refreshTally, refreshAccountVotes, voter]);

  useEffect(() => {
    const onFocus = () => { void refreshTally(); if (voter) void refreshAccountVotes(voter); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshTally, refreshAccountVotes, voter]);

  useEffect(() => subscribeGovernanceChanged((change) => {
    const relevant = change.referendumId == null || change.referendumId === referendumId;
    if (!relevant) return;
    void refreshTally();
    const address = voter ?? change.voter;
    if (address) void refreshAccountVotes(address, address === change.voter ? change.extrinsicIndex : undefined);
  }), [referendumId, refreshTally, refreshAccountVotes, voter]);

  const votes = override ? replaceAccountVotes(initialVotes, override.voter, override.rows) : initialVotes;
  // Only one indexed page is loaded: an absent voter may already be counted on another page.
  // Keep the indexed total until the server refreshes it, instead of double-counting an updated vote.
  const voteCount = initialVoteCount;
  const displayed: InitialTally = live
    ? { ...tally!, abstain: abstainAmountFromVotes(votes, decimals) }
    : { ...initial, aye: initial.aye, nay: initial.nay, supportAmount: initial.supportAmount, approval: initial.approval };

  return { tally: displayed, votes, voteCount, live, error, refreshTally, accountVotesLive: Boolean(voter && override?.voter === voter) };
}
