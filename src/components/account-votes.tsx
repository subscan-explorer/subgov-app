"use client";

import { TxDialog } from "@/components/tx-dialog";
import { Badge, ModuleHeader, Panel, StatusBadge } from "@/components/ui";
import { formatPlanck } from "@/components/undelegate";
import { useChainHref } from "@/hooks/use-chain-href";
import { readAccountVoting, type AccountVotingSnapshot } from "@/lib/account-chain";
import { unlockPlan, voteBalance, type TrackVote } from "@/lib/account-voting";
import type { ChainConfig } from "@/lib/chains";
import { referendumBriefs, type ReferendumBrief } from "@/lib/gov-actions";
import { convictionFromName } from "@/lib/vote";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

/** Reads `convictionVoting` state for one address; `reload` reads it again after a transaction. */
export function useAccountVoting(chain: ChainConfig, address: string | null | undefined) {
  const scope = JSON.stringify([chain.rpc, chain.genesisHash, address]);
  const [state, setState] = useState<{ scope: string; snapshot: AccountVotingSnapshot | null; error: string | null } | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    setState({ scope, snapshot: null, error: null });
    readAccountVoting({ rpc: chain.rpc, genesisHash: chain.genesisHash, address })
      .then((next) => { if (!cancelled) setState({ scope, snapshot: next, error: null }); })
      .catch((cause) => { if (!cancelled) setState({ scope, snapshot: null, error: cause instanceof Error ? cause.message : "Could not read votes" }); });
    return () => { cancelled = true; };
  }, [chain.rpc, chain.genesisHash, address, version, scope]);
  return { snapshot: state?.scope === scope ? state.snapshot : null, error: state?.scope === scope ? state.error : null, reload };
}

function voteLabel(item: TrackVote, chain: ChainConfig) {
  const vote = item.vote;
  if ("balance" in vote) return `${vote.mode} · ${formatPlanck(vote.balance, chain)} · ${convictionFromName(vote.conviction)}`;
  if (!("abstain" in vote)) return `Split · aye ${formatPlanck(vote.aye, chain)} / nay ${formatPlanck(vote.nay, chain)}`;
  return `Abstain · ${formatPlanck(vote.abstain, chain)}${vote.aye || vote.nay ? ` (+ aye ${formatPlanck(vote.aye, chain)} / nay ${formatPlanck(vote.nay, chain)})` : ""}`;
}

function outcomeLabel(item: TrackVote) {
  const state = item.outcome.state;
  return state === "ongoing" ? "Ongoing" : state === "timedOut" ? "Timed out" : state === "unknown" ? "Unknown" : state[0].toUpperCase() + state.slice(1);
}

/** Approximate wall-clock time for a governance block in the future (6 s relay blocks). */
function blocksAway(target: number, now: number) {
  const seconds = Math.max(0, target - now) * 6;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days > 0 ? `${days}d ${hours}h` : `${Math.max(1, hours)}h`;
}

/**
 * Every vote an address holds on-chain, grouped by track, with remove-vote and unlock actions when it is the
 * connected account. Titles come from Subscan; votes come from `convictionVoting.votingFor`.
 */
export function AccountVotes({ chain, address, canSign }: { chain: ChainConfig; address: string; canSign: boolean }) {
  return <AccountVotesForAccount key={`${chain.genesisHash}:${address}`} chain={chain} address={address} canSign={canSign} />;
}

function AccountVotesForAccount({ chain, address, canSign }: { chain: ChainConfig; address: string; canSign: boolean }) {
  const chainHref = useChainHref();
  const { snapshot, error, reload } = useAccountVoting(chain, address);
  const [briefs, setBriefs] = useState<Map<number, ReferendumBrief>>(new Map());
  const ids = useMemo(() => snapshot?.tracks.flatMap((track) => track.votes.map((vote) => vote.referendumId)) ?? [], [snapshot]);
  useEffect(() => {
    if (!ids.length) return;
    let cancelled = false;
    referendumBriefs(chain.id, ids)
      .then((rows) => { if (!cancelled) setBriefs(new Map(rows.map((row) => [row.id, row]))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [chain.id, ids]);

  const plan = snapshot ? unlockPlan(snapshot.tracks, snapshot.now) : null;
  const voteCount = ids.length;

  if (error) return <Panel padding="content"><p className="text-sm text-nay" role="alert">Could not read votes from {chain.name}: {error}</p></Panel>;
  if (!snapshot || !plan) return <Panel padding="content"><p className="text-sm text-mute" role="status">Reading votes and locks from {chain.name}…</p></Panel>;

  return (
    <div className="flex flex-col gap-6">
      <Panel padding="content">
        <ModuleHeader
          title="Voting lock"
          meta={canSign && (plan.remove.length || plan.unlock.length) ? (
            <TxDialog
              chain={chain}
              title="Unlock voting balance"
              triggerLabel="Unlock"
              variant="brass"
              size="sm"
              successText={`Expired votes are removed and the track locks are recalculated on ${chain.name}.`}
              submitLabel="Sign & unlock"
              onDone={reload}
              build={(api, { address: signerAddress }) => [
                ...plan.remove.map((item) => api.tx.convictionVoting.removeVote(item.trackId, item.referendumId)),
                ...plan.unlock.map((trackId) => api.tx.convictionVoting.unlock(trackId, signerAddress)),
              ]}
            >
              <ul className="divide-y divide-line border-y border-line text-sm">
                {plan.remove.map((item) => <li key={`r-${item.trackId}-${item.referendumId}`} className="py-2">Remove vote on #{item.referendumId} (track {item.trackId})</li>)}
                {plan.unlock.map((trackId) => <li key={`u-${trackId}`} className="py-2">Unlock track {trackId} · {snapshot.trackNames.get(trackId) ?? ""}</li>)}
              </ul>
              <p className="text-xs leading-5 text-mute">
                About {formatPlanck(plan.releasable, chain)} becomes transferable once included (locked {formatPlanck(plan.lockedBefore, chain)} → {formatPlanck(plan.lockedAfter, chain)}).
                {plan.remove.length + plan.unlock.length > 1 ? " All calls are sent in one utility.batchAll transaction." : ""}
              </p>
            </TxDialog>
          ) : undefined}
        />
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-mute">Locked by conviction voting</dt><dd className="num mt-1 text-lg">{formatPlanck(plan.lockedBefore, chain)}</dd></div>
          <div><dt className="text-xs text-mute">Unlockable now</dt><dd className="num mt-1 text-lg">{formatPlanck(plan.releasable, chain)}</dd></div>
          <div><dt className="text-xs text-mute">Votes on record</dt><dd className="num mt-1 text-lg">{voteCount}</dd></div>
        </dl>
      </Panel>

      {snapshot.tracks.filter((track) => track.votes.length || track.lock > BigInt(0) || track.prior).map((track) => (
        <Panel key={track.trackId} padding="content">
          <ModuleHeader
            title={`${track.trackId} · ${track.trackName}`}
            meta={<span className="num text-xs text-mute">lock {formatPlanck(track.lock, chain)}{track.delegated > BigInt(0) ? ` · delegating ${formatPlanck(track.delegated, chain)}` : ""}</span>}
          />
          {track.prior ? (
            <p className="mb-3 text-xs text-mute">
              Prior lock {formatPlanck(track.prior.amount, chain)} {track.prior.unlockAt <= snapshot.now ? "has expired" : `until block #${track.prior.unlockAt.toLocaleString()} (~${blocksAway(track.prior.unlockAt, snapshot.now)})`}.
            </p>
          ) : null}
          {track.votes.length ? (
            <ul className="divide-y divide-line">
              {track.votes.map((item) => {
                const brief = briefs.get(item.referendumId);
                const expired = item.unlockAt != null && item.unlockAt <= snapshot.now;
                return (
                  <li key={item.referendumId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link className="text-link" href={chainHref(`/referenda/${item.referendumId}/`)}>#{item.referendumId}</Link>
                        <span className="min-w-0 truncate text-paper">{brief?.title ?? ""}</span>
                        {brief ? <StatusBadge status={brief.status} /> : <Badge>{outcomeLabel(item)}</Badge>}
                      </div>
                      <div className="num mt-1 text-xs text-mute">
                        {voteLabel(item, chain)}
                        {item.unlockAt == null ? "" : expired ? " · lock expired" : ` · locked until #${item.unlockAt.toLocaleString()} (~${blocksAway(item.unlockAt, snapshot.now)})`}
                      </div>
                    </div>
                    {canSign ? (
                      <TxDialog
                        chain={chain}
                        title={`Remove vote on #${item.referendumId}`}
                        triggerLabel="Remove"
                        size="sm"
                        successText={item.outcome.state === "ongoing" ? "Your vote is withdrawn from the tally." : "The vote record is removed; run Unlock to release expired balance."}
                        submitLabel="Sign & remove vote"
                        onDone={reload}
                        build={(api) => api.tx.convictionVoting.removeVote(track.trackId, item.referendumId)}
                      >
                        <p className="text-sm leading-6">
                          {item.outcome.state === "ongoing"
                            ? `Referendum #${item.referendumId} is still open: removing the vote takes ${formatPlanck(voteBalance(item.vote), chain)} out of its tally.`
                            : `Referendum #${item.referendumId} has ended. Removing the vote keeps any remaining conviction lock until it expires.`}
                        </p>
                      </TxDialog>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-mute">No direct votes on this track.</p>}
        </Panel>
      ))}
      {!voteCount && plan.lockedBefore === BigInt(0) ? (
        <Panel padding="content"><p className="text-sm text-mute">No conviction votes or voting locks on {chain.name}. <Link className="text-link" href={chainHref("/referenda/", { status: "deciding" })}>Browse deciding referenda</Link></p></Panel>
      ) : null}
    </div>
  );
}
