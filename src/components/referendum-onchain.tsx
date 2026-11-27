"use client";

import { CallTreeView } from "@/components/call-tree-view";
import { MetaItem, MetaList, ModuleHeader, Panel } from "@/components/ui";
import { useChain } from "@/hooks/use-chain-href";
import { readReferendumOnChain, type OnChainReferendum } from "@/lib/call-chain";
import { callCount } from "@/lib/call-tree";
import { formatBlockPeriod, formatDot, shortAddr } from "@/lib/format";
import { subscribeGovernanceChanged } from "@/lib/governance-sync";
import type { Referendum, Track } from "@/lib/types";
import { useEffect, useMemo, useState } from "react";

/** Reconcile state/deposits; decoded calls also supply the default proposal payment summary. */
export function useReferendumOnChain(referendum: Referendum, decodeProposal: boolean) {
  const chain = useChain();
  const scope = useMemo(() => ({ rpc: chain.rpc, genesisHash: chain.genesisHash, decimals: chain.decimals, id: referendum.id, hash: referendum.preimageHash }), [chain.rpc, chain.genesisHash, chain.decimals, referendum.id, referendum.preimageHash]);
  const [state, setState] = useState<{ scope: object; data: OnChainReferendum | null; error: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    let request = 0;
    const refresh = () => {
      const current = ++request;
      readReferendumOnChain({ rpc: chain.rpc, genesisHash: chain.genesisHash, id: referendum.id, fallbackHash: referendum.preimageHash || undefined, decimals: chain.decimals, decodeProposal })
        .then((data) => { if (!cancelled && current === request) setState({ scope, data, error: null }); })
        .catch((cause) => { if (!cancelled && current === request) setState({ scope, data: null, error: cause instanceof Error ? cause.message : "Could not read the chain" }); });
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    const unsubscribe = subscribeGovernanceChanged((change) => { if (change.referendumId == null || change.referendumId === referendum.id) refresh(); });
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", refresh); unsubscribe(); };
  }, [chain.rpc, chain.genesisHash, chain.decimals, referendum.id, referendum.preimageHash, decodeProposal, scope]);
  return state?.scope === scope ? state : { data: null, error: null };
}

export function CallPanel({ state }: { state: ReturnType<typeof useReferendumOnChain> }) {
  const proposal = state.data?.proposal;
  return (
    <Panel padding="content">
      <ModuleHeader title="Call" meta={proposal?.status === "decoded" ? `${callCount(proposal.tree)} call${callCount(proposal.tree) === 1 ? "" : "s"}` : undefined} />
      {state.error ? <p className="text-sm text-nay" role="alert">{state.error}</p>
        : !state.data ? <p className="text-sm text-mute" role="status">Decoding the proposal from the chain…</p>
        : !proposal ? <p className="text-sm text-mute">No proposal call is recorded for this referendum.</p>
        : proposal.status === "missing" ? <p className="text-sm text-mute">{proposal.reason}.{proposal.hash ? <span className="num block break-all text-xs">{proposal.hash}</span> : null}</p>
        : <CallTreeView node={proposal.tree} />}
    </Panel>
  );
}

/** Proposal hash, length, enactment, track, deposits and the live confirming progress. */
export function MetadataPanel({ referendum: r, track, state, secondsPerBlock }: { referendum: Referendum; track?: Track; state: ReturnType<typeof useReferendumOnChain>; secondsPerBlock: number | null }) {
  const chain = useChain();
  const data = state.data;
  const proposal = data?.proposal;
  const confirmBlocks = Number(track?.confirmPeriod);
  const confirming = data?.deciding?.confirming;
  // `deciding.confirming` is the block at which confirmation completes.
  const confirmShare = confirming != null && confirmBlocks > 0 ? Math.min(1, Math.max(0, 1 - (confirming - data!.now) / confirmBlocks)) : null;
  return (
    <Panel padding="content">
      <ModuleHeader title="Metadata" />
      <MetaList>
        <MetaItem label="Proposal hash" value={proposal?.hash ?? r.preimageHash ? <span className="num break-all">{proposal?.hash ?? r.preimageHash}</span> : "—"} />
        <MetaItem label="Preimage length" value={proposal?.status === "decoded" && proposal.len ? `${proposal.len.toLocaleString()} bytes` : "—"} />
        <MetaItem label="Track" value={track ? `${track.id} · ${track.displayName}` : r.trackLabel ?? `Track ${r.trackId}`} />
        <MetaItem label="Enactment" value={data?.enactment ? (data.enactment.kind === "after" ? `${formatBlockPeriod(data.enactment.block, secondsPerBlock)} after approval (${data.enactment.block.toLocaleString()} blocks)` : `at block #${data.enactment.block.toLocaleString()}`) : r.status === "Executed" || r.status === "ExecutedFailed" ? r.status === "Executed" ? "Executed" : "Executed with an error" : "—"} />
        <MetaItem label="Submitted at" value={data?.submitted ? `#${data.submitted.toLocaleString()}` : `#${r.submittedBlock.toLocaleString()}`} />
        <MetaItem label="Deciding since" value={data?.deciding ? `#${data.deciding.since.toLocaleString()}` : "—"} />
        {confirmShare != null ? <MetaItem label="Confirming" value={
          <span className="flex min-w-0 flex-col gap-1">
            <span>{Math.round(confirmShare * 100)}% · ends #{confirming!.toLocaleString()}</span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2"><span className="block h-full bg-paper" style={{ width: `${confirmShare * 100}%` }} /></span>
          </span>
        } /> : null}
        <MetaItem label="Submission deposit" value={formatDot(r.submissionDeposit, chain.symbol)} />
        <MetaItem label="Decision deposit" value={formatDot(r.decisionDeposit, chain.symbol)} />
        <MetaItem label="Proposer" value={<span className="num" title={r.proposer}>{shortAddr(r.proposer, 6)}</span>} />
        <MetaItem label="Result" value={r.status === "Executed" ? "Executed successfully" : r.status === "ExecutedFailed" ? "Execution failed" : r.status} />
      </MetaList>
    </Panel>
  );
}
