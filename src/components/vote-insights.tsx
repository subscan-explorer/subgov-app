"use client";

import { DataNotice } from "@/components/data-notice";
import { ModuleHeader, Panel } from "@/components/ui";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import { bubbleBounds, packBubbles } from "@/lib/bubble-pack";
import { voteVotingPower } from "@/lib/conviction-voting";
import { formatBaseUnits, shortAddr } from "@/lib/format";
import { nestedVotes, voteStatistics, type NestedVote, type VoteStatistics } from "@/lib/gov-actions";
import type { Vote } from "@/lib/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const sideColor = { Aye: "var(--color-aye)", Nay: "var(--color-nay)", Abstain: "var(--color-abs)" } as const;

function toNumber(value: string, decimals: number) {
  try {
    return Number(BigInt(value) / BigInt(10) ** BigInt(Math.max(0, decimals - 4))) / 1e4;
  } catch {
    return 0;
  }
}

/** Bubble chart of voting power by voter; nested (direct + delegations) when the backend provides it. */
export function VoteBubbles({ votes, nested }: { votes: Vote[]; nested: NestedVote[] | null }) {
  const chain = useChain();
  const items = useMemo(() => nested?.length
    ? nested.map((row) => ({ item: { address: row.address, display: row.display, side: row.side, votes: row.votes, delegations: row.delegations.length }, weight: toNumber(row.votes, chain.decimals) }))
    : votes.map((vote) => {
        const power = voteVotingPower(vote);
        return { item: { address: vote.voter, display: vote.identity, side: vote.side, votes: (power ?? BigInt(0)).toString(), delegations: 0 }, weight: power ? toNumber(power.toString(), chain.decimals) : 0 };
      }), [nested, votes, chain.decimals]);
  const bubbles = useMemo(() => packBubbles(items, 60, 3), [items]);
  const [minX, minY, width, height] = bubbleBounds(bubbles);
  if (!bubbles.length) return <p className="text-sm text-mute">No votes to chart yet.</p>;
  return (
    <div>
      <svg viewBox={`${minX} ${minY} ${width} ${height}`} className="mx-auto max-h-96 w-full" role="img" aria-label="Aye/Nay voting power and Abstain support by voter">
        {bubbles.map((bubble, index) => (
          <circle key={index} cx={bubble.x} cy={bubble.y} r={bubble.r} fill={sideColor[bubble.item.side]} fillOpacity={0.75} stroke="var(--color-panel)" strokeWidth={0.8}>
            <title>{`${bubble.item.display ?? shortAddr(bubble.item.address, 6)} · ${bubble.item.side} · ${formatBaseUnits(bubble.item.votes, chain.decimals) ?? bubble.item.votes} ${chain.symbol} ${bubble.item.side === "Abstain" ? "support" : "votes"}${bubble.item.delegations ? ` · ${bubble.item.delegations} delegations` : ""}`}</title>
          </circle>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-mute">
        {(["Aye", "Nay", "Abstain"] as const).map((side) => <span key={side}><i className="mr-1.5 inline-block size-2 rounded-full" style={{ background: sideColor[side] }} />{side}</span>)}
        <span>{nested?.length ? "Size: Aye/Nay votes incl. delegations; Abstain support" : "Size: Aye/Nay voting power; Abstain support · shown votes"}</span>
      </div>
    </div>
  );
}

function NestedList({ rows }: { rows: NestedVote[] }) {
  const chain = useChain();
  const chainHref = useChainHref();
  const amount = (value: string) => `${formatBaseUnits(value, chain.decimals) ?? value} ${chain.symbol}`;
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => (
        <li key={`${row.address}-${row.side}`} className="py-3 text-sm">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
              <span className="min-w-0"><Link className="text-link" href={chainHref(`/user/${encodeURIComponent(row.address)}/`)}>{row.display ?? shortAddr(row.address, 6)}</Link> <span className={row.side === "Aye" ? "text-success-text" : row.side === "Nay" ? "text-error-text" : "text-mute"}>{row.side}</span></span>
              <span className="num text-xs text-mute">{amount(row.votes)}{row.delegations.length ? ` · ${row.delegations.length} delegations` : ""}</span>
            </summary>
            {row.delegations.length ? (
              <ul className="ml-4 mt-2 border-l border-line pl-3 text-xs">
                {row.delegations.map((item) => (
                  <li key={item.address} className="flex flex-wrap justify-between gap-2 py-1">
                    <Link className="text-link" href={chainHref(`/user/${encodeURIComponent(item.address)}/`)}>{item.display ?? shortAddr(item.address, 6)}</Link>
                    <span className="num text-mute">{amount(item.votes)}{item.conviction ? ` · ${item.conviction}` : ""}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="ml-4 mt-1 text-xs text-mute">No delegations.</p>}
          </details>
        </li>
      ))}
    </ul>
  );
}

function StatisticsView({ data }: { data: VoteStatistics }) {
  const chain = useChain();
  const total = (row: VoteStatistics["byConviction"][number]) => toNumber(row.aye, chain.decimals) + toNumber(row.nay, chain.decimals) + toNumber(row.abstain, chain.decimals);
  const max = Math.max(1, ...data.byConviction.map(total));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-6 text-sm">
        {data.directAccounts != null ? <span>Direct voters <span className="num">{data.directAccounts.toLocaleString()}</span></span> : null}
        {data.delegatedAccounts != null ? <span>Delegated voters <span className="num">{data.delegatedAccounts.toLocaleString()}</span></span> : null}
      </div>
      <ul className="flex flex-col gap-3">
        {data.byConviction.map((row) => {
          const aye = toNumber(row.aye, chain.decimals);
          const nay = toNumber(row.nay, chain.decimals);
          const abstain = toNumber(row.abstain, chain.decimals);
          return (
            <li key={row.conviction} className="text-sm">
              <div className="flex justify-between gap-3"><span>{row.conviction === "None" ? "0.1x" : row.conviction.replace("Locked", "")}</span><span className="num text-xs text-mute">{row.accounts} accounts</span></div>
              <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-panel-2" style={{ width: `${(total(row) / max) * 100}%`, minWidth: "2px" }}>
                <span className="bg-aye" style={{ flex: aye }} /><span className="bg-nay" style={{ flex: nay }} /><span className="bg-abs" style={{ flex: abstain }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Bubble / nested / statistics views next to the flat vote table. */
export function VoteInsights({ referendumId, votes }: { referendumId: number; votes: Vote[] }) {
  const chain = useChain();
  const [view, setView] = useState<"bubble" | "nested" | "statistics">("bubble");
  const [nested, setNested] = useState<{ available: boolean; rows: NestedVote[] } | null>(null);
  const [stats, setStats] = useState<{ available: boolean; data: VoteStatistics | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    nestedVotes(chain.id, referendumId).then((value) => { if (!cancelled) setNested(value); }).catch(() => { if (!cancelled) setNested({ available: false, rows: [] }); });
    voteStatistics(chain.id, referendumId).then((value) => { if (!cancelled) setStats(value); }).catch(() => { if (!cancelled) setStats({ available: false, data: null }); });
    return () => { cancelled = true; };
  }, [chain.id, referendumId]);
  return (
    <Panel padding="content">
      <ModuleHeader title="Vote analysis" meta={
        <span className="flex gap-1" role="group" aria-label="Vote view">
          {(["bubble", "nested", "statistics"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}
              className={view === value ? "rounded-full bg-paper px-3 py-1 text-xs text-ink" : "rounded-full bg-panel-2 px-3 py-1 text-xs text-mute hover:text-paper"}>
              {value === "bubble" ? "Bubble" : value === "nested" ? "Nested" : "Statistics"}
            </button>
          ))}
        </span>
      } />
      {view === "bubble" ? <VoteBubbles votes={votes} nested={nested?.available ? nested.rows : null} />
        : view === "nested" ? (!nested ? <p className="text-sm text-mute" role="status">Loading…</p> : nested.available ? <NestedList rows={nested.rows} /> : <DataNotice kind="info" title="Waiting on the data service">Nested votes with their delegations need the vote index requested in subgov #94.</DataNotice>)
        : (!stats ? <p className="text-sm text-mute" role="status">Loading…</p> : stats.available && stats.data ? <StatisticsView data={stats.data} /> : <DataNotice kind="info" title="Waiting on the data service">Vote statistics by conviction need the endpoint requested in subgov #94.</DataNotice>)}
    </Panel>
  );
}
