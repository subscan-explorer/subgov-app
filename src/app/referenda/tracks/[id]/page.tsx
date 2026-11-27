import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DataNotice } from "@/components/data-notice";
import { Curve, ReferendumRow } from "@/components/gov";
import { PendingBackend } from "@/components/pending-backend";
import { ArrowLink, MetaItem, MetaList, ModuleHeader, PageHeader, Panel, StatStrip } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { formatBlockPeriod, formatPlanck } from "@/lib/format";
import { activeNetwork } from "@/lib/network-server";
import { liveGovernanceBlockSeconds } from "@/lib/governance-clock-server";
import { liveReferendumDeadlines, liveReferenda, liveTracks } from "@/lib/subscan-data";
import { optionalGovernance } from "@/lib/subscan-optional";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: `Track #${(await params).id}` };
}

type TrackStats = { track?: { origin?: string; total?: number; approved?: number; rejected?: number; other?: number; deciding?: number; confirming?: number } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ chain?: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const network = await activeNetwork((await searchParams).chain);
  const chain = governanceChains[network];
  const [tracks, secondsPerBlock] = await Promise.all([liveTracks(network).catch(() => null), liveGovernanceBlockSeconds(network)]);
  if (tracks === null) return <DataNotice kind="error">Unable to load tracks from Subscan.</DataNotice>;
  const track = tracks.find((item) => item.id === Number(id));
  if (!track) notFound();
  const [stats, active] = await Promise.all([
    // `origin` on scan/referenda/statistics is requested in subgov#91.
    optionalGovernance<TrackStats>(network, "scan/referenda/statistics", { origin: track.name }),
    liveReferenda(network, { status: "active", origin: track.name, row: 20 }).catch(() => null),
  ]);
  const deadlines = active ? await liveReferendumDeadlines(active.rows, tracks, network) : new Map<number, string>();
  const trackStats = stats.available ? stats.data.track : undefined;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: withChain("/referenda/tracks/", network), label: "Tracks" }} kicker={`${chain.name} · track #${track.id}`} title={track.displayName} description={track.description} />
      <StatStrip items={[
        { label: "Active referenda", value: active ? active.count.toLocaleString() : track.activeCount?.toLocaleString() ?? "—" },
        { label: "Max deciding", value: track.maxDeciding || "—" },
        { label: "Decision deposit", value: formatPlanck(track.decisionDeposit, chain.decimals, chain.symbol) },
      ]} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel padding="content">
          <ModuleHeader title="Parameters" />
          <MetaList>
            <MetaItem label="Prepare period" value={formatBlockPeriod(track.preparePeriod, secondsPerBlock)} />
            <MetaItem label="Decision period" value={formatBlockPeriod(track.decisionPeriod, secondsPerBlock)} />
            <MetaItem label="Confirm period" value={formatBlockPeriod(track.confirmPeriod, secondsPerBlock)} />
            <MetaItem label="Min enactment" value={formatBlockPeriod(track.minEnactmentPeriod, secondsPerBlock)} />
            <MetaItem label="Min approval" value={track.minApproval} />
            <MetaItem label="Min support" value={track.minSupport} />
          </MetaList>
        </Panel>
        <Panel padding="content">
          <ModuleHeader title="Decision curves" />
          {track.minApprovalCurve || track.minSupportCurve ? <Curve approval={track.minApprovalCurve} support={track.minSupportCurve} /> : <p className="text-sm text-mute">No curve data for this track.</p>}
        </Panel>
      </div>
      <Panel padding="content">
        <ModuleHeader title="Outcomes" />
        {trackStats ? (
          <StatStrip items={[
            { label: "Total", value: (trackStats.total ?? 0).toLocaleString() },
            { label: "Approved", value: (trackStats.approved ?? 0).toLocaleString() },
            { label: "Rejected", value: (trackStats.rejected ?? 0).toLocaleString() },
            { label: "Deciding / confirming", value: `${trackStats.deciding ?? 0} / ${trackStats.confirming ?? 0}` },
          ]} />
        ) : stats.available ? <p className="text-sm text-mute">Per-track totals are not in this response yet (subgov #91).</p> : <PendingBackend result={stats} issue={91} what="Per-track outcome totals" />}
      </Panel>
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl">Active referenda</h2>
          <ArrowLink href={withChain("/referenda/", network, { track: track.id })}>All on this track</ArrowLink>
        </div>
        {active === null ? <DataNotice kind="error">Referenda could not be loaded.</DataNotice> : active.rows.length === 0 ? <DataNotice kind="empty" title="Nothing active">No referenda are active on this track.</DataNotice> : (
          <Panel className="divide-y divide-line">{active.rows.map((r) => <ReferendumRow key={r.id} r={r} deadline={deadlines.get(r.id)} />)}</Panel>
        )}
      </section>
    </div>
  );
}
