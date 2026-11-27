import type { Metadata } from "next";
import { BarList, PendingBackend } from "@/components/pending-backend";
import { ButtonLink, ModuleHeader, PageHeader, Panel, StatStrip } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { activeNetwork } from "@/lib/network-server";
import { listOf, optionalGovernance, ratioPercent } from "@/lib/subscan-optional";
import { formatOriginName } from "@/lib/referendum-tracks";

export const metadata: Metadata = { title: "Referendum statistics" };

type PassRate = { total?: number; passed?: number; rejected?: number; other?: number; pass_rate?: string };
type Month = { month: string; total?: number; passed?: number; rejected?: number; other?: number; pass_rate?: string };
type TrackRate = { origin: string; total?: number; passed?: number; pass_rate?: string };

const pct = (value: number | null) => (value == null ? "—" : `${value.toFixed(1)}%`);

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string; axis?: string }> }) {
  const query = await searchParams;
  const network = await activeNetwork(query.chain);
  const chain = governanceChains[network];
  const timeAxis = query.axis === "submitted" ? "submitted" : "finalized";
  // Endpoints requested in subgov#95 (same rollup as the treasury pass rate).
  const [summary, monthly, tracks] = await Promise.all([
    optionalGovernance<PassRate>(network, "scan/referenda/pass_rate", { time_axis: timeAxis }),
    optionalGovernance<unknown>(network, "scan/referenda/pass_rate/monthly", { time_axis: timeAxis }),
    optionalGovernance<unknown>(network, "scan/referenda/pass_rate/tracks", { time_axis: timeAxis }),
  ]);
  const months = monthly.available ? listOf<Month>(monthly.data).slice(-24) : [];
  const maxMonth = Math.max(1, ...months.map((m) => m.total ?? 0));
  const trackRows = tracks.available ? listOf<TrackRate>(tracks.data).sort((a, b) => (b.total ?? 0) - (a.total ?? 0)) : [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: withChain("/referenda/", network), label: "Referenda" }}
        kicker={chain.name}
        title="Referendum statistics"
        description={`Pass rate across all OpenGov tracks, by month and by track. Months are UTC and grouped by ${timeAxis === "submitted" ? "submission" : "final outcome"} time.`}
        actions={<ButtonLink variant="ghost" className="subscan-action-link" href={withChain("/referenda/statistics/", network, { axis: timeAxis === "submitted" ? undefined : "submitted" })}>Group by {timeAxis === "submitted" ? "outcome" : "submission"} time</ButtonLink>}
      />
      {summary.available ? (
        <StatStrip items={[
          { label: "Referenda decided", value: (summary.data.total ?? 0).toLocaleString() },
          { label: "Passed", value: (summary.data.passed ?? 0).toLocaleString() },
          { label: "Rejected", value: (summary.data.rejected ?? 0).toLocaleString() },
          { label: "Pass rate", value: pct(ratioPercent(summary.data.pass_rate)) },
        ]} />
      ) : <PendingBackend result={summary} issue={95} what="Referendum pass-rate statistics" />}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel padding="content">
          <ModuleHeader title="By month" meta="UTC" />
          {!monthly.available ? <PendingBackend result={monthly} issue={95} what="Monthly statistics" /> : months.length === 0 ? <p className="text-sm text-mute">No decided referenda yet.</p> : (
            <div className="flex h-48 items-end gap-1" role="img" aria-label="Referenda per month, passed share highlighted">
              {months.map((m) => (
                <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${m.month}: ${m.passed ?? 0} passed of ${m.total ?? 0} (${pct(ratioPercent(m.pass_rate))})`}>
                  <div className="flex w-full flex-col justify-end overflow-hidden rounded-t" style={{ height: `${((m.total ?? 0) / maxMonth) * 160}px` }}>
                    <div className="bg-nay/70" style={{ flex: (m.total ?? 0) - (m.passed ?? 0) }} />
                    <div className="bg-aye" style={{ flex: m.passed ?? 0 }} />
                  </div>
                  <span className="num text-[10px] text-mute">{m.month.slice(2)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel padding="content">
          <ModuleHeader title="By track" />
          {!tracks.available ? <PendingBackend result={tracks} issue={95} what="Per-track statistics" /> : (
            <BarList items={trackRows.map((row) => ({ label: formatOriginName(row.origin) || row.origin, value: ratioPercent(row.pass_rate), detail: `${row.passed ?? 0}/${row.total ?? 0} · ${pct(ratioPercent(row.pass_rate))}` }))} />
          )}
        </Panel>
      </div>
    </div>
  );
}
