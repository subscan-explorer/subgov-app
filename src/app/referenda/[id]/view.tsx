"use client";

import { useChain, useChainHref } from "@/hooks/use-chain-href";
import { useApp } from "@/components/app-state";
import { CommentThread } from "@/components/comment-thread";
import { ReferendumPost } from "@/components/referendum-post";
import { ProposalRequests } from "@/components/proposal-requests";
import { subsquareUrl } from "@/lib/governance-source";
import { Addr, Curve, Markdown, Tally, Timeline, VoteDialog, VoteTable } from "@/components/gov";
import { Badge, DetailLayout, MetaItem, MetaList, ModuleHeader, PageHeader, Panel, StatusBadge, TrackBadge } from "@/components/ui";
import { SubscanLink } from "@/components/subscan-link";
import { PlaceDecisionDeposit, RefundReferendumDeposits } from "@/components/referendum-deposits";
import { CallPanel, MetadataPanel, useReferendumOnChain } from "@/components/referendum-onchain";
import { VoteInsights } from "@/components/vote-insights";
import type { DiscussionTarget } from "@/lib/discussion";
import type { GovernanceComment, GovernancePost } from "@/lib/subscan-data";
import type { Referendum, Track } from "@/lib/types";
import { decisionCurveThreshold } from "@/lib/decision-curve";
import { decisionProgress, onChainReferendumDeadline } from "@/lib/referendum-deadline";
import { formatBlockPeriod, formatDate, formatDot, shortAddr } from "@/lib/format";
import { useLiveReferendumTally } from "@/hooks/use-live-referendum-tally";
import { withLiveReferendum } from "@/lib/referendum-live";
import Link from "next/link";
import { useEffect, useState } from "react";

export function ReferendumView({
  referendum: initialReferendum,
  track,
  voteCount,
  votesPage = 0,
  votesPageSize = 20,
  votesFailed = false,
  secondsPerBlock,
  governancePost,
  discussionTarget,
  discussionError,
}: {
  referendum: Referendum;
  track?: Track;
  voteCount?: number;
  votesPage?: number;
  votesPageSize?: number;
  votesFailed?: boolean;
  /** Measured seconds per governance block, used only for approximate durations. */
  secondsPerBlock: number | null;
  governancePost?: GovernancePost;
  discussionTarget: DiscussionTarget | null;
  discussionError?: string;
}) {
  const chain = useChain();
  const { account } = useApp();
  const chainHref = useChainHref();
  const [tab, setTab] = useState<ReferendumTab>(votesPage > 0 ? "votes" : "proposal");
  const onChain = useReferendumOnChain(initialReferendum, true);
  const r = withLiveReferendum(initialReferendum, onChain.data?.fields);
  const live = useLiveReferendumTally({
    rpc: chain.rpc,
    genesisHash: chain.genesisHash,
    referendumId: r.id,
    trackId: r.trackId,
    decimals: chain.decimals,
    voter: account,
    initial: { aye: r.aye, nay: r.nay, supportAmount: r.supportAmount ?? null, approval: r.approval, abstain: r.abstain },
    initialVotes: r.votes ?? [],
    initialVoteCount: voteCount,
  });
  const trackLabel = track?.displayName ?? r.trackLabel ?? `Track ${r.trackId}`;
  const progress = decisionProgress(onChain.data, track);
  const deadline = onChainReferendumDeadline(onChain.data, track, secondsPerBlock);
  useEffect(() => {
    const fromHash = () => {
      const hash = window.location.hash.slice(1);
      if ((REFERENDUM_TABS as readonly string[]).includes(hash)) setTab(hash as ReferendumTab);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, []);
  const selectTab = (next: ReferendumTab) => {
    setTab(next);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${next === "proposal" ? "" : `#${next}`}`);
  };
  const approvalThreshold = progress != null && track?.minApprovalCurve ? decisionCurveThreshold(track.minApprovalCurve, progress.share) * 100 : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: chainHref("/referenda/"), label: "Referenda" }}
        kicker={`Referendum #${r.id}`}
        title={r.title}
        description={r.summary}
      />
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={r.status} />
        <TrackBadge label={trackLabel} />
        {deadline ? <span className="text-xs text-mute">{deadline}</span> : null}
        <SubscanLink kind="referenda_v2" value={r.id} className="text-xs">
          View on Subscan
        </SubscanLink>
      </div>
      <DetailLayout
        lead={
          <Panel padding="compact">
            <ModuleHeader title="Tally" />
            <Tally
              aye={live.tally.aye}
              nay={live.tally.nay}
              abstain={live.tally.abstain}
              abstainIsPartial={live.live}
              approval={live.tally.approval}
              support={r.support}
              supportAmount={live.tally.supportAmount}
              approvalThreshold={approvalThreshold}
            />
            {onChain.error ? <p className="mt-2 text-xs text-mute">Current decision thresholds are unavailable: {onChain.error}</p> : !onChain.data && (r.status === "Deciding" || r.status === "Confirming") ? <p className="mt-2 text-xs text-mute" role="status">Reading current decision thresholds…</p> : null}
            {track?.minApprovalCurve || track?.minSupportCurve ? <div className="mt-4">
              <Curve approval={track?.minApprovalCurve} support={track?.minSupportCurve} progress={progress?.share} currentApproval={live.tally.approval} />
              <div className="mt-1 flex justify-between text-xs font-medium text-mute">
                <span>start</span>
                <span>decision period</span>
              </div>
            </div> : null}
            <div className="mt-5 flex flex-col items-start gap-2">
              <VoteDialog referendum={r} />
              <PlaceDecisionDeposit referendum={r} track={track} />
              <RefundReferendumDeposits key={`${chain.id}:${r.id}`} referendum={r} />
            </div>
          </Panel>
        }
        main={<>
          <ReferendumTabs tab={tab} onTab={selectTab} />
          {tab === "proposal" ? <>
            <ProposalRequests proposal={onChain.data?.proposal} error={onChain.error} loaded={Boolean(onChain.data)} />
            <ReferendumPost content={governancePost?.content ?? String(r.content ?? "On-chain referendum data supplied by Subscan.")}
              sourceBadge={governancePost?.source && governancePost.source.toLowerCase() !== "subscan" ? `${governancePost.source} · via Subscan` : undefined} sourceUrl={subsquareUrl(chain.id, "referendums_v2", r.id)} />
            <Panel padding="content">
              <ModuleHeader title="Timeline" />
              <Timeline referendum events={r.timeline ?? []} />
            </Panel>
          </> : null}
          {tab === "call" ? <CallPanel state={onChain} /> : null}
          {tab === "metadata" ? <MetadataPanel referendum={r} track={track} state={onChain} secondsPerBlock={secondsPerBlock} /> : null}
          {tab === "votes" ? <>
            <Panel padding="content">
              <ModuleHeader
                id="votes"
                title="Votes"
                meta={live.voteCount != null && !votesFailed ? `${live.voteCount.toLocaleString()} indexed` : null}
              />
              {votesFailed ? (
                <p className="text-sm text-nay" role="alert">Votes could not be loaded from Subscan right now.</p>
              ) : (
                <VoteTable votes={live.votes} />
              )}
              {votesFailed && live.accountVotesLive && live.votes.length > 0 ? <VoteTable votes={live.votes} /> : null}
              {live.accountVotesLive ? <p className="mt-3 text-xs text-mute">Your account’s current vote is checked on-chain. The indexed total may lag.</p> : null}
              {!votesFailed && live.voteCount != null && live.voteCount > votesPageSize ? (
                <VotesPager id={r.id} page={votesPage} totalPages={Math.ceil(live.voteCount / votesPageSize)} />
              ) : null}
            </Panel>
            <VoteInsights referendumId={r.id} votes={live.votes} />
          </> : null}
          {governancePost?.comments.length ? (
            <ExternalComments comments={governancePost.comments} count={governancePost.commentCount} />
          ) : null}
          <CommentThread target={discussionTarget} initialError={discussionError} referendumIndex={r.id} />
        </>}
        details={
          <Panel padding="compact">
            <ModuleHeader title="Details" />
            <MetaList>
              <MetaItem label="Proposer" value={<Addr address={r.proposer} identity={r.proposerIdentity} />} />
              <MetaItem label="Submitted" value={formatDate(r.submittedAt)} />
              <MetaItem label="Block" value={r.submittedBlock > 0 ? <SubscanLink kind="block" value={r.submittedBlock} referendumBlockAt={r.submittedAt}>#{r.submittedBlock}</SubscanLink> : "—"} />
              {track ? <>
                <MetaItem label="Decision period" value={trackPeriodLabel(track.decisionPeriod, secondsPerBlock)} />
                <MetaItem label="Confirmation period" value={trackPeriodLabel(track.confirmPeriod, secondsPerBlock)} />
              </> : null}
              <MetaItem label="Decision deposit" value={formatDot(r.decisionDeposit, chain.symbol)} />
              <MetaItem label="Submission deposit" value={formatDot(r.submissionDeposit, chain.symbol)} />
              <MetaItem label="Preimage" value={
                r.preimageHash ? (
                  <SubscanLink kind="preimage" value={r.preimageHash}>
                    {shortAddr(r.preimageHash, 6)}
                  </SubscanLink>
                ) : "—"
              } />
              <MetaItem label="Call" value={r.call} />
              {r.spendId ? (
                <MetaItem
                  label="Treasury spend"
                  value={
                    <Link href={chainHref(`/treasury/spends/${r.spendId}/`)} className="text-link">
                      Spend #{r.spendId}
                    </Link>
                  }
                />
              ) : null}
            </MetaList>
          </Panel>
        }
      />
    </div>
  );
}

function trackPeriodLabel(blocks: string, secondsPerBlock: number | null) {
  if (!/^\d+$/.test(blocks)) return blocks;
  const exact = `${Number(blocks).toLocaleString("en-US")} blocks`;
  return secondsPerBlock != null && secondsPerBlock > 0 ? `${exact} (est. ${formatBlockPeriod(blocks, secondsPerBlock)})` : exact;
}

const REFERENDUM_TABS = ["proposal", "call", "metadata", "votes"] as const;
type ReferendumTab = (typeof REFERENDUM_TABS)[number];

function ReferendumTabs({ tab, onTab }: { tab: ReferendumTab; onTab: (tab: ReferendumTab) => void }) {
  const labels: Record<ReferendumTab, string> = { proposal: "Proposal", call: "Call", metadata: "Metadata", votes: "Votes" };
  return (
    <div role="tablist" aria-label="Referendum sections" className="flex flex-wrap gap-2">
      {REFERENDUM_TABS.map((value) => (
        <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => onTab(value)}
          className={tab === value ? "rounded-full bg-paper px-4 py-2 text-sm text-ink" : "rounded-full bg-panel px-4 py-2 text-sm text-mute hover:text-paper"}>
          {labels[value]}
        </button>
      ))}
    </div>
  );
}

function ExternalComments({ comments, count }: { comments: GovernanceComment[]; count: number }) {
  return (
    <Panel padding="content">
      <ModuleHeader title="Proposal discussion" meta={`${count} via Subscan`} />
      <p className="-mt-2 mb-4 text-xs leading-5 text-mute">Comments from the proposal forum, read-only here. Community comments on SubGov are below.</p>
      <div className="divide-y divide-line">
        {comments.map((comment) => <ExternalComment key={comment.id} comment={comment} />)}
      </div>
    </Panel>
  );
}

function ExternalComment({ comment }: { comment: GovernanceComment }) {
  const author = comment.username ?? comment.address ?? comment.ethereumAddress ?? "Unknown author";
  const authorLabel = author.length > 40 ? shortAddr(author, 8) : author;
  const createdAt = comment.createdAt && !Number.isNaN(Date.parse(comment.createdAt)) ? formatDate(comment.createdAt) : null;
  return (
    <article className="py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-mute">
        <span className="num min-w-0 break-all text-paper" title={author}>{authorLabel}</span>
        {createdAt ? <time dateTime={comment.createdAt}>{createdAt}</time> : null}
      </div>
      {comment.content ? <div className="mt-2 text-sm"><Markdown text={comment.content} /></div> : null}
      {comment.replies.length ? (
        <div className="ml-3 mt-3 border-l border-line pl-4">
          {comment.replies.map((reply) => <ExternalComment key={reply.id} comment={reply} />)}
        </div>
      ) : null}
    </article>
  );
}

function VotesPager({ id, page, totalPages }: { id: number; page: number; totalPages: number }) {
  const chainHref = useChainHref();
  const href = (n: number) => `${chainHref(`/referenda/${id}/`, { votes: n > 1 ? n : undefined })}#votes`;
  return (
    <nav aria-label="Vote pages" className="mt-4 flex items-center justify-between gap-3 text-sm">
      {page > 0 ? <Link className="section-action" href={href(page)}>← Newer</Link> : <span />}
      <span className="text-mute">Page {page + 1} of {totalPages}</span>
      {page + 1 < totalPages ? <Link className="section-action" href={href(page + 2)}>Older →</Link> : <span />}
    </nav>
  );
}
