import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { withChain } from "@/lib/chain-query";
import { ReferendumJump } from "@/components/referendum-jump";
import { excerptTitle, formatDate, pctOrDash, statusTone } from "@/lib/format";
import { hasReferendumTally } from "@/lib/referendum-tally";
import { rowStatus, type TreasuryRow } from "@/lib/subscan-treasury";
import { tokenFromRow } from "@/lib/tokens";
import type { ChainId, Referendum } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * Overview bento. Server components only: every figure comes from data the page already fetches —
 * the latest referenda page, referenda counts per status filter, and the latest treasury spends page.
 */

export type StatusCounts = { total: number; active: number | null; preparing: number | null; deciding: number | null; confirming: number | null; executed: number | null };

const OPEN = ["Preparing", "Deciding", "Confirming"];

/** Big figure with a quieter tail, e.g. 80 + ".9% avg". */
function Figure({ value, tail, className }: { value: string; tail?: string; className?: string }) {
  return (
    <div className={cn("ov-figure num", className)}>
      {value}
      {tail ? <small>{tail}</small> : null}
    </div>
  );
}

function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="ov-circle" aria-label={label}>
      <ArrowUpRight size={16} aria-hidden="true" />
    </Link>
  );
}

function splitNumber(n: number, digits = 1) {
  const [int, frac] = n.toFixed(digits).split(".");
  return { int, frac: frac ? `.${frac}` : "" };
}

function compact(n: number) {
  const units: [number, string][] = [[1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, unit] of units) if (Math.abs(n) >= size) return { value: (n / size).toFixed(2).replace(/\.?0+$/, ""), unit };
  return { value: n.toLocaleString("en-US", { maximumFractionDigits: 2 }), unit: "" };
}

export function OverviewHeader({ counts, chainName, network }: { counts: StatusCounts | null; chainName: string; network: ChainId }) {
  const countsUnavailable = counts != null && [counts.active, counts.preparing, counts.deciding, counts.confirming, counts.executed].some((n) => n == null);
  const parts = counts
    ? ([["deciding", counts.deciding], ["confirming", counts.confirming], ["preparing", counts.preparing]] as const).filter(([, n]) => (n ?? 0) > 0)
    : [];
  return (
    <div className="ov-head">
      <div className="ov-head-text">
        <h1 className="ov-title">Governance overview</h1>
        <p className="ov-lede">
          {countsUnavailable ? "Some status counts are temporarily unavailable. " : null}{counts && !countsUnavailable && parts.length ? (
            <>
              {parts.map(([label, n], i) => (
                <span key={label}>{i ? <span className="ov-sep"> · </span> : null}<b className="num">{n} {label}</b></span>
              ))}{" "}
              across {counts.total.toLocaleString()} indexed referenda on {chainName}.
            </>
          ) : counts && !countsUnavailable ? `Nothing is open among ${counts.total.toLocaleString()} indexed referenda on ${chainName}.` : "Live OpenGov referenda and treasury data from Subscan."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={withChain("/referenda/", network)} className="ov-pill ov-pill-dark">Browse referenda</Link>
        <Link href={withChain("/referenda/new/", network)} className="ov-pill">New proposal</Link>
        <ReferendumJump />
      </div>
    </div>
  );
}

export function OpenCard({ counts, latest, network }: { counts: StatusCounts | null; latest: Referendum[]; network: ChainId }) {
  const breakdownReady = counts != null && counts.deciding != null && counts.confirming != null && counts.preparing != null;
  const breakdown = breakdownReady ? Number(counts.deciding) + Number(counts.confirming) + Number(counts.preparing) : null;
  const open = counts?.active != null ? counts.active : breakdown != null ? breakdown : latest.filter((r) => OPEN.includes(r.status)).length;
  const openReady = counts?.active != null || breakdown != null;
  const spotlight = latest.find((r) => r.status === "Confirming")
    ?? [...latest].filter((r) => r.status === "Deciding" && hasReferendumTally(r)).sort((a, b) => (b.approval ?? 0) - (a.approval ?? 0))[0];
  return (
    <section className="ov-card ov-hero" aria-labelledby="ov-open-title">
      <div className="ov-card-head"><h2 id="ov-open-title">Open referenda</h2><CardLink href={withChain("/referenda/", network, { status: "active" })} label="Active referenda" /></div>
      <Figure className="ov-figure-xl" value={openReady || !counts ? String(open) : "—"} tail={openReady && counts ? `/ ${counts.total.toLocaleString()}` : undefined} />
      <div className="ov-chips">
        {counts?.deciding ? <Link href={withChain("/referenda/", network, { status: "deciding" })} className="ov-chip"><i className="ov-dot ov-dot-accent" />{counts.deciding} deciding</Link> : null}
        {counts?.confirming ? <Link href={withChain("/referenda/", network, { status: "confirming" })} className="ov-chip"><i className="ov-dot ov-dot-ink" />{counts.confirming} confirming</Link> : null}
        {counts?.preparing ? <Link href={withChain("/referenda/", network, { status: "preparing" })} className="ov-chip"><i className="ov-dot ov-dot-prep" />{counts.preparing} preparing</Link> : null}
      </div>
      {spotlight ? (
        <Link href={withChain(`/referenda/${spotlight.id}/`, network)} className="ov-spot">
          <div className="ov-spot-top"><span className="mono">#{spotlight.id} · {spotlight.trackLabel ?? `Track ${spotlight.trackId}`}</span><span>{spotlight.status}</span></div>
          <div className="ov-spot-title">{excerptTitle(spotlight.title)}</div>
          <div className="ov-bar"><span style={{ width: `${Math.min(100, Math.max(0, spotlight.approval ?? 0))}%` }} /></div>
          <div className="ov-spot-foot"><span>Approval <b className="num">{pctOrDash(spotlight.approval)}</b></span><span>{spotlight.status === "Confirming" ? "confirming now" : "highest approval deciding"}</span></div>
        </Link>
      ) : null}
    </section>
  );
}

export function ApprovalCard({ latest, network }: { latest: Referendum[]; network: ChainId }) {
  const rows = [...latest].sort((a, b) => a.id - b.id);
  const voted = rows.filter(hasReferendumTally);
  const avg = voted.length ? voted.reduce((sum, r) => sum + (r.approval ?? 0), 0) / voted.length : null;
  const highlight = [...rows].reverse().find((r) => r.status === "Deciding" && hasReferendumTally(r))?.id;
  const { int, frac } = avg != null ? splitNumber(avg) : { int: "—", frac: "" };
  return (
    <section className="ov-card ov-approval" aria-labelledby="ov-approval-title">
      <div className="ov-card-head"><h2 id="ov-approval-title">Approval</h2><span className="ov-label">latest {rows.length}</span><CardLink href={withChain("/referenda/", network)} label="All referenda" /></div>
      <Figure value={int} tail={avg != null ? `${frac}% avg` : undefined} />
      <div className="ov-label mt-1.5">{voted.length ? `across ${voted.length} referenda with approval data` : "no approval data indexed yet"}</div>
      <div className="ov-chart" role="list" aria-label="Approval of the latest referenda">
        <div className="ov-ref-line" aria-hidden="true"><span>50%</span></div>
        {rows.map((r, i) => {
          const value = hasReferendumTally(r) ? Math.min(100, Math.max(0, r.approval ?? 0)) : null;
          return (
            <Link
              key={r.id}
              role="listitem"
              href={withChain(`/referenda/${r.id}/`, network)}
              className={cn("ov-col", r.id === highlight && "is-hl")}
              aria-label={`Referendum ${r.id}: ${value != null ? `${value.toFixed(1)}% approval` : "no votes"}`}
            >
              <span className="ov-col-track">
                <span className="ov-col-bar" style={{ height: value != null && value > 0 ? `${value}%` : "4px", animationDelay: `${i * 50}ms` }}>
                  <span className="ov-tag num">{value != null ? `${value.toFixed(1)}%` : "no votes"}</span>
                </span>
              </span>
              <span className="ov-col-x mono">{r.id}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

type Bucket = { status: string; count: number; total: number };

export function TreasuryCard({ spends, count, network }: { spends: TreasuryRow[] | null; count: number | null; network: ChainId }) {
  const totals = new Map<string, { total: number; buckets: Map<string, Bucket> }>();
  for (const row of spends ?? []) {
    const { amount, symbol, decimals } = tokenFromRow(row, network);
    const value = Number(amount) / 10 ** (decimals ?? 0);
    if (!Number.isFinite(value) || !symbol) continue;
    const asset = totals.get(symbol) ?? { total: 0, buckets: new Map() };
    asset.total += value;
    const status = rowStatus(row);
    const bucket = asset.buckets.get(status) ?? { status, count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += value;
    asset.buckets.set(status, bucket);
    totals.set(symbol, asset);
  }
  const [primary, ...others] = [...totals.entries()].sort((a, b) => b[1].total - a[1].total);
  const buckets = primary ? [...primary[1].buckets.values()].sort((a, b) => b.total - a.total) : [];
  let neutral = 0;
  const tone = (status: string) => {
    const t = statusTone(status);
    if (t === "live" || t === "warn") return "accent";
    return ["ink", "prep", "other"][Math.min(2, neutral++)];
  };
  const toned = buckets.map((b) => ({ ...b, tone: tone(b.status) }));
  const head = primary ? compact(primary[1].total) : null;
  const shown = spends?.length ?? 0;
  return (
    <section className="ov-card ov-treasury" aria-labelledby="ov-treasury-title">
      <div className="ov-card-head"><h2 id="ov-treasury-title">Treasury spends</h2><CardLink href={withChain("/treasury/spends/", network)} label="All treasury spends" /></div>
      {head && primary ? (
        <>
          <Figure value={head.value} tail={`${head.unit} ${primary[0]}`} />
          <div className="ov-label mt-1.5">
            latest {shown} spends{count != null && count > shown ? ` of ${count.toLocaleString()}` : ""}
            {others.map(([symbol, asset]) => ` · plus ${compact(asset.total).value}${compact(asset.total).unit} ${symbol}`).join("")}
          </div>
          <div className="ov-stack" aria-hidden="true">
            {toned.map((b) => <span key={b.status} className={`ov-fill-${b.tone}`} style={{ flexGrow: b.total, minWidth: 8 }} />)}
          </div>
          <div className="ov-t-rows">
            {toned.slice(0, 3).map((b) => {
              const v = compact(b.total);
              return <div key={b.status} className="ov-t-row"><span><i className={`ov-dot ov-fill-${b.tone}`} />{b.status} · {b.count}</span><b className="num">{v.value}{v.unit}</b></div>;
            })}
          </div>
        </>
      ) : (
        <p className="ov-label">{spends === null ? "Treasury spends are unavailable right now." : "No treasury spends are indexed for this network."}</p>
      )}
    </section>
  );
}

export function StatusCard({ counts, network }: { counts: StatusCounts | null; network: ChainId }) {
  if (!counts) {
    return <section className="ov-card ov-status"><div className="ov-card-head"><h2>Status</h2></div><p className="ov-label">Status counts are unavailable right now.</p></section>;
  }
  const known = (counts.deciding ?? 0) + (counts.confirming ?? 0) + (counts.preparing ?? 0) + (counts.executed ?? 0);
  const segments = [
    { key: "deciding", label: "Deciding", n: counts.deciding ?? 0, stroke: "url(#ov-brand)", dot: "ov-dot-accent", href: withChain("/referenda/", network, { status: "deciding" }) },
    { key: "confirming", label: "Confirming", n: counts.confirming ?? 0, stroke: "var(--ov-ink)", dot: "ov-dot-ink", href: withChain("/referenda/", network, { status: "confirming" }) },
    { key: "preparing", label: "Preparing", n: counts.preparing ?? 0, stroke: "var(--ov-prep)", dot: "ov-dot-prep", href: withChain("/referenda/", network, { status: "preparing" }) },
    { key: "executed", label: "Executed", n: counts.executed ?? 0, stroke: "var(--ov-aye)", dot: "ov-dot-aye", href: withChain("/referenda/", network, { status: "executed" }) },
    { key: "other", label: "Other closed", n: Math.max(0, counts.total - known), stroke: "var(--ov-other)", dot: "ov-dot-other", href: withChain("/referenda/", network) },
  ];
  const r = 70;
  const c = 2 * Math.PI * r;
  const gap = 1.5;
  let offset = 0;
  const arcs = segments.map((s) => {
    const len = counts.total ? (c * s.n) / counts.total : 0;
    const arc = { ...s, dash: Math.max(0, len - (len > gap ? gap : 0)), offset };
    offset += len;
    return arc;
  });
  return (
    <section className="ov-card ov-status" aria-labelledby="ov-status-title">
      <div className="ov-card-head"><h2 id="ov-status-title">Status</h2><span className="ov-label">all indexed</span></div>
      <div className="ov-donut">
        <svg viewBox="0 0 176 176" role="img" aria-label={segments.map((s) => `${s.label} ${s.n}`).join(", ")}>
          <defs>
            <linearGradient id="ov-brand" x1="0" y1="1" x2="0.33" y2="0">
              <stop offset="8%" stopColor="rgb(254,56,118)" stopOpacity="0.75" />
              <stop offset="92%" stopColor="#D030DD" />
            </linearGradient>
          </defs>
          <circle cx="88" cy="88" r={r} className="ov-donut-track" />
          {arcs.filter((a) => a.n > 0).map((a) => (
            <circle key={a.key} cx="88" cy="88" r={r} stroke={a.stroke} strokeDasharray={`${a.dash} ${c}`} strokeDashoffset={-a.offset} />
          ))}
        </svg>
        <div className="ov-donut-c"><div className="ov-figure num">{counts.total.toLocaleString()}</div><div className="ov-label">referenda</div></div>
      </div>
      <div className="ov-legend">
        {segments.map((s) => (
          <Link key={s.key} href={s.href}>
            <i className={`ov-dot ${s.dot}`} />
            <span>{s.label}</span>
            <span className="ov-share num">{counts.total ? Math.round((s.n * 100) / counts.total) : 0}%</span>
            <b className="num">{s.n.toLocaleString()}</b>
          </Link>
        ))}
      </div>
    </section>
  );
}

const statusDot = (status: string) => {
  if (status === "Deciding") return "ov-dot-accent";
  if (status === "Confirming") return "ov-dot-ink";
  if (status === "Preparing") return "ov-dot-prep";
  const tone = statusTone(status);
  return tone === "good" ? "ov-dot-aye" : tone === "bad" ? "ov-dot-nay" : "ov-dot-other";
};

export function LatestCard({ latest, network }: { latest: Referendum[]; network: ChainId }) {
  return (
    <section className="ov-card ov-latest" aria-labelledby="ov-latest-title">
      <div className="ov-card-head">
        <h2 id="ov-latest-title">Latest referenda</h2>
        <Link href={withChain("/referenda/", network)} className="ov-pill ov-pill-soft">View all<ArrowRight size={14} aria-hidden="true" /></Link>
      </div>
      <div className="ov-t-head" aria-hidden="true"><span>ID</span><span>Proposal</span><span>Status</span><span>Approval</span></div>
      <div className="ov-rows">
        {latest.slice(0, 6).map((r) => (
          <Link key={r.id} href={withChain(`/referenda/${r.id}/`, network)} className="ov-r">
            <span className="ov-r-id mono">#{r.id}</span>
            <span className="ov-r-t">
              <span className="ov-r-title">{excerptTitle(r.title)}</span>
              <small>{r.trackLabel ?? `Track ${r.trackId}`} · {r.proposerIdentity ?? formatDate(r.submittedAt)}</small>
            </span>
            <span className="ov-r-st"><i className={`ov-dot ${statusDot(r.status)}`} />{r.status}</span>
            <span className="ov-r-ap">
              {hasReferendumTally(r) ? (
                <><span className="ov-bar ov-bar-sm"><span style={{ width: `${Math.min(100, Math.max(0, r.approval ?? 0))}%` }} /></span><span className="num">{pctOrDash(r.approval)}</span></>
              ) : (
                <><span className="ov-bar ov-bar-sm ov-bar-empty" /><span className="ov-faint">no votes</span></>
              )}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
