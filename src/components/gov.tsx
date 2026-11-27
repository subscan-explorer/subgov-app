"use client";

import { useSubmissionLock, useWalletScope } from "@/hooks/use-submission-lock";

import { ProxyNote } from "@/components/wallet-extras";
import { Modal } from "@/components/modal";
import { useApp } from "@/components/app-state";
import { SubscanLink } from "@/components/subscan-link";
import { CopyButton } from "@/components/copy-button";
import { TimelineItem, TimelineList } from "@/components/timeline";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import { Badge, Button, Checkbox, Field, Input, Panel, RecordRow, StatusBadge, TextButton, TrackBadge } from "@/components/ui";
import { ConvictionFields } from "@/components/conviction-field";
import { decisionCurveThreshold } from "@/lib/decision-curve";
import { formatDate, formatDot, formatToken, pctOrDash, planckToToken, shortAddr } from "@/lib/format";
import { governanceInclusionPhase, hasReferendumTally, TALLY_SUPPORT_HINT, TALLY_VOTING_POWER_HINT } from "@/lib/referendum-tally";
import { notifyGovernanceChanged } from "@/lib/governance-sync";
import { formatBalance, tokenForChain, type TokenMeta } from "@/lib/tokens";
import type { DecisionCurve, Referendum, TimelineEvent, Vote, VoteSide } from "@/lib/types";
import { ID } from "@/lib/mock";
import { cn } from "@/lib/utils";
import { buildConvictionVote, convictionVoteBalance, voteVotingPower, VOTE_MODES, type ExistingVote, type VoteAmounts, type VoteMode } from "@/lib/conviction-voting";
import { convictionFromName, convictionValue, readVotingContext, submitReferendumVote, type Conviction, type VoteProgress, type VotingContext } from "@/lib/vote";
import { walletCanSignOnChain } from "@/lib/wallet-chain";
import { preconnectChainApi } from "@/lib/chain-api";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { useEffect, useMemo, useRef, useState } from "react";

export function Addr({ address, identity }: { address: string; identity?: string }) {
  const chainHref = useChainHref();
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
    <Link href={chainHref(`/user/${address}/`)} title={address} className="min-w-0 text-link hover:underline">
      <span className="min-w-0 break-words">{identity ?? ID[address] ?? shortAddr(address)}</span>
    </Link>
    <CopyButton value={address} label="Copy address" />
    </span>
  );
}

export function Tally({
  aye,
  nay,
  abstain,
  abstainIsPartial,
  approval,
  support,
  supportAmount,
  compact,
  approvalOnly,
  approvalThreshold,
}: {
  aye: string | null;
  nay: string | null;
  abstain?: string | null;
  abstainIsPartial?: boolean;
  approval: number | null;
  support: number | null;
  supportAmount?: string | null;
  compact?: boolean;
  approvalOnly?: boolean;
  /** Minimum approval (0–100) at this point of the decision period. */
  approvalThreshold?: number | null;
}) {
  const chain = useChain();
  if (approvalOnly) {
    return (
      <div className="min-w-0 text-sm leading-snug">
        <div className="text-mute">Approval</div>
        <div className="num">{pctOrDash(approval)}</div>
      </div>
    );
  }
  const a = aye != null ? Number(aye) : NaN;
  const n = nay != null ? Number(nay) : NaN;
  const hasBar = Number.isFinite(a) && Number.isFinite(n) && a + n > 0;
  const ayePct = hasBar ? (a / (a + n)) * 100 : 50;
  return (
    <div className={cn("flex min-w-0 flex-col", compact ? "gap-2" : "gap-3")}>
      {approvalThreshold != null && approval != null ? (
        <p className="text-xs leading-5 text-mute">
          <span className={approval >= approvalThreshold ? "text-aye" : "text-nay"}>{approval >= approvalThreshold ? "Above" : "Below"} the approval threshold</span>
          {" "}· needs {pctOrDash(approvalThreshold)} now
        </p>
      ) : null}
      {hasBar ? (
        <div className="relative">
          <div className="flex h-2 overflow-hidden rounded-full bg-ink">
            <div className="tally-segment tally-segment-aye bg-aye" style={{ width: `${ayePct}%` }} />
            <div className="tally-segment tally-segment-nay bg-nay" style={{ width: `${100 - ayePct}%` }} />
          </div>
          {approvalThreshold != null ? <span className="tally-threshold" style={{ left: `${Math.min(100, Math.max(0, approvalThreshold))}%` }} aria-hidden="true" /> : null}
        </div>
      ) : null}
      <div
        className={cn(
          "grid min-w-0 gap-x-3 gap-y-1 text-sm leading-snug",
          "grid-cols-2",
        )}
      >
        <div className="min-w-0">
          <div className="text-mute">Aye <span className="ml-1 text-[10px] font-medium uppercase tracking-wide" title={TALLY_VOTING_POWER_HINT}>voting power</span></div>
          <div className="text-aye num break-words" title={TALLY_VOTING_POWER_HINT}>{formatToken(aye, chain.symbol)}</div>
        </div>
        <div className="min-w-0">
          <div className="text-mute">Nay <span className="ml-1 text-[10px] font-medium uppercase tracking-wide" title={TALLY_VOTING_POWER_HINT}>voting power</span></div>
          <div className="text-nay num break-words" title={TALLY_VOTING_POWER_HINT}>{formatToken(nay, chain.symbol)}</div>
        </div>
        <div className="min-w-0">
          <div className="text-mute">Approval</div>
          <div className="num">{pctOrDash(approval)}</div>
        </div>
        <div className="min-w-0">
          <div className="text-mute">Support <span className="ml-1 text-[10px] font-medium uppercase tracking-wide" title={TALLY_SUPPORT_HINT}>raw capital</span></div>
          <div className="num break-words" title={TALLY_SUPPORT_HINT}>
            {support != null ? pctOrDash(support) : supportAmount ? formatToken(supportAmount, chain.symbol) : "—"}
          </div>
        </div>
      </div>
      {abstain ? (
        <div className="text-xs text-mute">{abstainIsPartial ? "Abstain in shown votes" : "Abstain"} {formatToken(abstain, chain.symbol)}</div>
      ) : null}
    </div>
  );
}

export function Curve({
  approval,
  support,
  progress,
  currentApproval,
}: {
  approval?: DecisionCurve;
  support?: DecisionCurve;
  /** Elapsed share of the decision period, 0–1, when known. */
  progress?: number | null;
  /** Current approval, 0–100. */
  currentApproval?: number | null;
}) {
  if (!approval && !support) return null;
  const w = 320;
  const h = 120;
  const path = (curve: DecisionCurve) => Array.from({ length: 41 }, (_, i) => {
    const x = i / 40;
    return `${i ? "L" : "M"} ${x * w} ${h - decisionCurveThreshold(curve, x) * h}`;
  }).join(" ");
  const nowX = progress != null && Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) * w : null;
  const nowY = nowX != null && currentApproval != null && Number.isFinite(currentApproval) ? h - (Math.min(100, Math.max(0, currentApproval)) / 100) * h : null;
  return (
    <div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <div className="flex flex-col justify-between py-0.5 text-right text-[10px] leading-none text-mute" aria-hidden="true"><span>100%</span><span>50%</span><span>0%</span></div>
        <svg viewBox={`-4 -4 ${w + 8} ${h + 8}`} className="w-full overflow-visible" role="img" aria-label={`Minimum approval and support thresholds across the decision period${nowX != null ? `; ${Math.round((progress ?? 0) * 100)}% of the period has elapsed` : ""}`}>
          <path d={`M 0 0 H ${w} M 0 ${h / 2} H ${w} M 0 ${h} H ${w}`} fill="none" stroke="currentColor" className="text-line" strokeWidth="1" />
          {approval ? <path d={path(approval)} fill="none" stroke="var(--color-chart-approval)" strokeWidth="2" /> : null}
          {support ? <path d={path(support)} fill="none" stroke="var(--color-live)" strokeWidth="2" /> : null}
          {nowX != null ? <line x1={nowX} x2={nowX} y1={0} y2={h} stroke="var(--color-mute)" strokeWidth="1" strokeDasharray="3 3" /> : null}
          {nowX != null && nowY != null ? <circle cx={nowX} cy={nowY} r="4.5" fill="var(--color-panel)" stroke="var(--color-chart-approval)" strokeWidth="2" /> : null}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-mute">
        {approval ? <span><i className="mr-1.5 inline-block size-1.5 rounded-full bg-chart-approval" />Approval · {approval.label}</span> : null}
        {support ? <span><i className="mr-1.5 inline-block size-1.5 rounded-full bg-live" />Support · {support.label}</span> : null}
        {nowX != null ? <span>┆ now{nowY != null ? " · ◯ current approval" : ""}</span> : null}
      </div>
    </div>
  );
}

export function Timeline({ events, referendum = false, explorer }: { events: TimelineEvent[]; referendum?: boolean; explorer?: string }) {
  return (
    <TimelineList>
      {events.map((e) => (
        <TimelineItem
          key={e.id}
          title={e.title}
          date={formatDate(e.at)}
          block={e.block > 0 ? explorer ? <a href={`${explorer}/block/${e.block}`} target="_blank" rel="noreferrer" className="num text-xs text-link">#{e.block} ↗</a> : <SubscanLink kind="block" value={e.block} referendumBlockAt={referendum ? e.at : undefined} className="num text-xs">#{e.block}</SubscanLink> : <span className="num text-xs text-mute">—</span>}
          detail={e.detail}
        />
      ))}
    </TimelineList>
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-gov">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="nofollow noreferrer" />,
        }}
      >
        {String(text ?? "")}
      </ReactMarkdown>
    </div>
  );
}

function formatVotePower(vote: Vote, token: TokenMeta) {
  if (vote.side === "Abstain") return "Support only";
  const power = voteVotingPower(vote);
  return power == null ? "—" : formatBalance(power, token);
}

export function VoteTable({ votes }: { votes: Vote[] }) {
  const chain = useChain();
  const token = tokenForChain(chain.id);
  if (!votes.length) return <p className="text-sm text-mute">No votes indexed yet.</p>;
  return (
    <div className="table-scroll overflow-x-auto">
      <table className="subscan-table w-full min-w-[680px] text-left text-sm">
        <thead className="text-xs font-medium text-mute">
          <tr>
            <th scope="col">Voter</th>
            <th scope="col">Side</th>
            <th scope="col">Amount</th>
            <th scope="col">Conviction</th>
            <th scope="col">Voting power</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          {votes.map((v) => (
            <tr key={`${v.relayChain ? "relay" : "hub"}-${v.voter}-${v.extrinsicIndex ?? v.at}-${v.side}`} className="group">
              <td>
                <Addr address={v.voter} identity={v.identity} />
              </td>
              <td className={v.side === "Aye" ? "text-aye" : v.side === "Nay" ? "text-nay" : "text-abs"}>
                {v.side}
                {v.split ? <span className="ml-2 align-middle" title={v.split === "SplitAbstain" ? "Part of a split vote with abstain" : "Part of a split aye/nay vote"}><Badge>{v.split === "SplitAbstain" ? "Split abstain" : "Split"}</Badge></span> : null}
              </td>
              <td className="num whitespace-nowrap ">{formatBalance(v.amount, token)}</td>
              <td>{v.conviction}</td>
              <td className="num whitespace-nowrap">{formatVotePower(v, token)}</td>
              <td className="min-w-28 text-mute">{v.at ? formatDate(v.at) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function describeVote(vote: ExistingVote, decimals: number, symbol: string) {
  const amount = (value: bigint) => `${planckToToken(value.toString(), decimals) ?? "0"} ${symbol}`;
  if ("balance" in vote) return `${vote.mode} · ${amount(vote.balance)} · ${convictionFromName(vote.conviction)}`;
  if (vote.mode === "Split") return `Split · aye ${amount(vote.aye)} / nay ${amount(vote.nay)}`;
  return `Abstain · abstain ${amount(vote.abstain)} / aye ${amount(vote.aye)} / nay ${amount(vote.nay)}`;
}

function SplitAmountFields({ mode, amounts, onAmounts, symbol, disabled }: {
  mode: "Split" | "Abstain";
  amounts: VoteAmounts;
  onAmounts: (value: VoteAmounts) => void;
  symbol: string;
  disabled?: boolean;
}) {
  const fields = (mode === "Abstain" ? ["abstain", "aye", "nay"] : ["aye", "nay"]) as ("abstain" | "aye" | "nay")[];
  return (
    <div className="flex flex-col gap-3">
      <div className={cn("grid gap-3", mode === "Abstain" ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {fields.map((key) => (
          <Field key={key} label={`${key[0].toUpperCase()}${key.slice(1)} (${symbol})`}>
            <Input
              name={`${key}-amount`}
              value={amounts[key] ?? ""}
              inputMode="decimal"
              autoComplete="off"
              placeholder={key === "abstain" ? `0 ${symbol}` : "0 (optional)"}
              disabled={disabled}
              onChange={(event) => onAmounts({ ...amounts, [key]: event.target.value })}
            />
          </Field>
        ))}
      </div>
      <p className="rounded-2xl bg-panel-2 px-4 py-3 text-xs leading-5 text-mute">
        {mode === "Split"
          ? "Split votes put part of the balance on aye and part on nay. They carry no conviction (0.1× voting power, no lock after the vote)."
          : "Abstain counts toward support only. You may add aye and nay parts; all parts carry no conviction (0.1×, no lock after the vote)."}
      </p>
    </div>
  );
}

function amountsFromVote(vote: ExistingVote, decimals: number): VoteAmounts {
  const token = (value: bigint) => (value > BigInt(0) ? planckToToken(value.toString(), decimals) ?? "" : "");
  if ("balance" in vote) return { amount: token(vote.balance) };
  if (vote.mode === "Split") return { aye: token(vote.aye), nay: token(vote.nay) };
  return { aye: token(vote.aye), nay: token(vote.nay), abstain: token(vote.abstain) };
}

export function VoteDialog(props: { referendum: Referendum }) {
  const chain = useChain();
  const scope = useWalletScope(chain.genesisHash);
  return <VoteDialogSession key={`${scope}:${props.referendum.id}:${props.referendum.trackId}`} {...props} />;
}

function VoteDialogSession({ referendum }: { referendum: Referendum }) {
  const { account, signer, walletSource, walletConnectGenesisHash, openWalletDialog, proxySigner } = useApp();
  const chain = useChain();
  const chainHref = useChainHref();
  const walletReady = walletCanSignOnChain(walletSource, walletConnectGenesisHash, chain.genesisHash);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<VoteMode>("Aye");
  const [amounts, setAmounts] = useState<VoteAmounts>({});
  const [conviction, setConviction] = useState<Conviction>("1x");
  const [mainnetApproved, setMainnetApproved] = useState(false);
  const [progress, setProgress] = useState<VoteProgress | null>(null);
  // Finality arrives after the dialog may have been closed and reopened; ignore stale updates.
  const session = useRef(0);
  const submission = useSubmissionLock();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ txHash: string; blockHash: string; mode: VoteMode } | null>(null);
  const [loadedVote, setLoadedVote] = useState<{ key: string; context: VotingContext | null; error: string | null } | null>(null);
  const [contextVersion, setContextVersion] = useState(0);
  const contextKey = JSON.stringify([chain.genesisHash, account, referendum.id, referendum.trackId, contextVersion]);
  const loaded = loadedVote?.key === contextKey ? loadedVote : null;
  const context = loaded?.context ?? null;
  const contextError = loaded?.error ?? null;
  const active = ["Preparing", "Deciding", "Confirming"].includes(referendum.status);
  const submitting = progress != null && progress !== "Finalized" && !result;
  const editingDisabled = !context || submitting;
  const format = (value: bigint) => `${planckToToken(value.toString(), chain.decimals) ?? "0"} ${chain.symbol}`;

  useEffect(() => {
    // Warm the shared chain connection so the dialog opens on a ready API.
    if (active && account && walletReady) preconnectChainApi(chain.rpc, chain.genesisHash);
  }, [active, account, walletReady, chain.rpc, chain.genesisHash]);

  useEffect(() => {
    if (!open || !account) return;
    let cancelled = false;
    readVotingContext({ rpc: chain.rpc, genesisHash: chain.genesisHash, address: account, trackId: referendum.trackId, referendumId: referendum.id })
      .then((next) => {
        if (cancelled) return;
        const existing = next.existing;
        setMode(existing?.mode ?? "Aye");
        setAmounts(existing ? amountsFromVote(existing, chain.decimals) : {});
        setConviction(existing && "balance" in existing ? convictionFromName(existing.conviction) : "1x");
        setLoadedVote({ key: contextKey, context: next, error: null });
      })
      .catch((loadError) => {
        const error = loadError instanceof Error ? loadError.message : "Could not read the current vote and balance";
        if (!cancelled) setLoadedVote({ key: contextKey, context: null, error });
      });
    return () => { cancelled = true; };
  }, [open, account, chain.rpc, chain.genesisHash, chain.decimals, referendum.trackId, referendum.id, contextKey]);

  const draft = useMemo(() => {
    try {
      const vote = buildConvictionVote(mode, amounts, chain.decimals, convictionValue(conviction));
      return { total: convictionVoteBalance(vote), error: null };
    } catch (draftError) {
      return { total: null, error: draftError instanceof Error ? draftError.message : "Invalid vote" };
    }
  }, [mode, amounts, chain.decimals, conviction]);
  const touched = Object.values(amounts).some((value) => value?.trim());
  const overBalance = context != null && draft.total != null && draft.total > context.votable;
  const blocked = context?.delegating != null;
  const submitDisabled = !active || !account || !signer || !walletReady || editingDisabled || draft.total == null
    || overBalance || blocked || (!chain.testnet && !mainnetApproved);

  return (
    <>
      {!active ? (
        <>
          <Button className="w-full" disabled aria-describedby={`vote-closed-${referendum.id}`}>Vote</Button>
          <p id={`vote-closed-${referendum.id}`} className="text-xs text-mute">Voting is closed — this referendum is {referendum.status.toLowerCase()}.</p>
        </>
      ) : !account || !walletReady ? (
        <>
          <Button className="w-full" onClick={() => openWalletDialog(chain)}>{walletSource === "watch" ? "Connect a wallet to vote" : account ? "Reconnect to vote" : "Connect to vote"}</Button>
          <p className="text-xs text-mute">{walletSource === "watch" ? "This is a watch-only address. Connect a wallet to vote." : account ? `Connect WalletConnect to ${chain.name} before voting.` : "Voting needs a connected wallet account."}</p>
        </>
      ) : (
        <Button
          className="w-full"
          onClick={() => {
            setError(null);
            setProgress(null);
            setResult(null);
            setMainnetApproved(false);
            setLoadedVote(null);
            session.current += 1;
            setOpen(true);
          }}
          disabled={!signer}
        >
          Vote
        </Button>
      )}
      {open ? (
        <Modal titleId="vote-title" onClose={() => setOpen(false)} busy={submitting}>
          <Panel padding="content" className="max-h-[calc(100dvh-2rem)] w-full overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="vote-title" className="font-display text-base">{context?.existing ? "Change vote" : "Vote"} on #{referendum.id}</h2>
              <TextButton type="button" tone="neutral" disabled={submitting} onClick={() => setOpen(false)}>
                Close
              </TextButton>
            </div>
            {result ? (
              <div className="flex flex-col gap-3">
                <Badge tone="good" className="w-fit">Finalized</Badge>
                <p className="text-sm">Your {result.mode} vote is finalized on {chain.name}.</p>
                <div className="rounded-2xl bg-panel-2 p-3 text-xs text-mute">
                  <div className="break-all">Transaction <SubscanLink kind="extrinsic" value={result.txHash} className="num">{result.txHash}</SubscanLink></div>
                  <div className="mt-1 break-all">Block <SubscanLink kind="block" value={result.blockHash} className="num">{result.blockHash}</SubscanLink></div>
                </div>
                <Button onClick={() => setOpen(false)}>Close</Button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (submitDisabled || !account || !signer || !submission.begin()) return;
                  setError(null);
                  const submissionSession = session.current;
                  try {
                    const receipt = await submitReferendumVote({
                      rpc: chain.rpc,
                      genesisHash: chain.genesisHash,
                      referendumId: referendum.id,
                      trackId: referendum.trackId,
                      mode,
                      amounts,
                      decimals: chain.decimals,
                      conviction,
                      address: account,
                      signer,
                      walletSource,
                      signAs: proxySigner,
                      onProgress: (next) => {
                        if (submission.active() && session.current === submissionSession) setProgress(next);
                        const phase = governanceInclusionPhase(next);
                        if (phase) {
                          notifyGovernanceChanged({
                            reason: "vote",
                            phase,
                            referendumId: referendum.id,
                            trackId: referendum.trackId,
                            voter: account,
                          });
                        }
                      },
                    });
                    if (submission.active() && session.current === submissionSession) setResult({ ...receipt, mode });
                  } catch (submitError) {
                    if (!submission.active() || session.current !== submissionSession) return;
                    setProgress(null);
                    setError(submitError instanceof Error ? submitError.message : "Vote submission failed");
                  } finally { submission.end(); }
                }}
              >
                <div className="border-line grid gap-2 border-y py-2 text-sm sm:grid-cols-[8rem_1fr]">
                  <span className="text-mute">Network</span>
                  <span>{chain.name}{chain.testnet ? " · testnet" : " · mainnet"}</span>
                  <span className="text-mute">Voting balance before fees</span>
                  <span className="num">{context ? format(context.votable) : contextError ? "—" : "Checking…"}</span>
                  {context && context.trackLock > BigInt(0) ? (
                    <>
                      <span className="text-mute">Locked on track</span>
                      <span className="num">{format(context.trackLock)}</span>
                    </>
                  ) : null}
                </div>
                {context?.existing ? (
                  <p className="rounded-2xl bg-panel-2 px-4 py-3 text-xs leading-5 text-mute">
                    Current vote: <b className="num font-semibold text-paper">{describeVote(context.existing, chain.decimals, chain.symbol)}</b>. Submitting replaces it.
                  </p>
                ) : null}
                {context?.delegating ? (
                  <p className="text-sm text-nay" role="alert">
                    This account delegates {format(context.delegating.balance)} on this track to {shortAddr(context.delegating.target)}. <Link className="text-link" href={chainHref("/account/")}>Undelegate it</Link> before voting directly.
                  </p>
                ) : null}
                {contextError ? (
                  <div className="flex items-center gap-2 text-xs text-nay">
                    <p role="alert">Could not load the current vote and balance. {contextError}</p>
                    <TextButton type="button" onClick={() => setContextVersion((version) => version + 1)}>Retry</TextButton>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {VOTE_MODES.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      aria-pressed={mode === s}
                      variant={mode === s ? (s === "Nay" ? "nay" : s === "Aye" ? "aye" : "brass") : "ghost"}
                      disabled={editingDisabled}
                      onClick={() => setMode(s)}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
                {mode === "Aye" || mode === "Nay" ? (
                  <ConvictionFields amount={amounts.amount ?? ""} onAmount={(amount) => setAmounts({ ...amounts, amount })} conviction={conviction} onConviction={setConviction} symbol={chain.symbol} disabled={editingDisabled} />
                ) : (
                  <SplitAmountFields mode={mode} amounts={amounts} onAmounts={setAmounts} symbol={chain.symbol} disabled={editingDisabled} />
                )}
                {touched && draft.error ? <p className="text-xs text-nay" role="alert">{draft.error}</p> : null}
                {overBalance ? <p className="text-xs text-nay" role="alert">Vote total {format(draft.total!)} exceeds your votable balance.</p> : null}
                {!chain.testnet ? (
                  <label className="flex items-start gap-2 text-sm text-mute">
                    <Checkbox name="mainnet-approval" className="mt-1" checked={mainnetApproved} disabled={editingDisabled} onChange={(e) => setMainnetApproved(e.target.checked)} />
                    <span>I understand this submits a real {chain.symbol} mainnet transaction and may charge a fee.</span>
                  </label>
                ) : (
                  <p className="text-xs text-mute">Testnet transaction; PAS has no monetary value. A network fee still applies.</p>
                )}
                <ProxyNote />
                {error ? <p className="text-sm text-nay" role="alert">{error}</p> : null}
                {progress ? <p className="text-sm text-link" aria-live="polite">{progress}…</p> : null}
                <Button type="submit" disabled={submitDisabled}>
                  {submitting ? "Submitting…" : context?.existing ? "Sign & change vote" : "Sign & submit"}
                </Button>
              </form>
            )}
          </Panel>
        </Modal>
      ) : null}
    </>
  );
}

export function ReferendumRow({ r, deadline }: { r: Referendum; deadline?: string }) {
  const chainHref = useChainHref();
  const voted = hasReferendumTally(r);
  return (
    <RecordRow
      href={chainHref(`/referenda/${r.id}/`)}
      id={`#${r.id}`}
      badges={<><StatusBadge status={r.status} /><TrackBadge label={r.trackLabel ?? `Track ${r.trackId}`} /></>}
      title={r.title}
      meta={<>by {r.proposerIdentity ?? shortAddr(r.proposer)} · {deadline ?? formatDate(r.submittedAt)}</>}
      valueLabel="Approval"
      value={voted ? pctOrDash(r.approval) : "No votes"}
      meter={voted ? r.approval : null}
    />
  );
}
