import type { Metadata } from "next";
import { DataNotice } from "@/components/data-notice";
import { ApprovalCard, LatestCard, OpenCard, OverviewHeader, StatusCard, TreasuryCard, type StatusCounts } from "@/components/overview";
import { chains } from "@/lib/chains";
import { activeNetwork } from "@/lib/network-server";
import { liveReferenda, liveTracks } from "@/lib/subscan-data";
import { MyTodo } from "@/components/overview-extras";
import { ModuleHeader, Panel } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import Link from "next/link";
import { treasuryLive } from "@/lib/subscan-treasury";

export const metadata: Metadata = { title: "Governance overview" };

/** Referenda count for one status filter (the same filters the Referenda list offers). */
async function countFor(network: Awaited<ReturnType<typeof activeNetwork>>, status: string) {
  try {
    return (await liveReferenda(network, { status, row: 1 })).count;
  } catch {
    return null;
  }
}

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const { chain: chainParam } = await searchParams;
  const network = await activeNetwork(chainParam);
  const [referendaData, active, preparing, deciding, confirming, executed, spendsPage, tracks] = await Promise.all([
    liveReferenda(network, { row: 8 }).catch(() => null),
    countFor(network, "active"),
    countFor(network, "preparing"),
    countFor(network, "deciding"),
    countFor(network, "confirming"),
    countFor(network, "executed"),
    treasuryLive.spendsPage(network, { page: 0, row: 10 }).catch(() => null),
    liveTracks(network).catch(() => []),
  ]);
  const countsAvailable = tracks.length > 0 && tracks.every((track) => track.activeCount != null);
  const inFlight = tracks.filter((track) => (track.activeCount ?? 0) > 0).sort((a, b) => (b.activeCount ?? 0) - (a.activeCount ?? 0));

  const latest = referendaData?.rows ?? [];
  const counts: StatusCounts | null = referendaData ? { total: referendaData.count, active, preparing, deciding, confirming, executed } : null;
  const chainName = chains.find((item) => item.id === network)?.name ?? "this network";

  return (
    <div className="ov">
      <OverviewHeader counts={counts} chainName={chainName} network={network} />
      {referendaData ? (
        <div className="ov-grid">
          <OpenCard counts={counts} latest={latest} network={network} />
          <ApprovalCard latest={latest} network={network} />
          <TreasuryCard spends={spendsPage?.rows ?? null} count={spendsPage?.count ?? null} network={network} />
          <StatusCard counts={counts} network={network} />
          <LatestCard latest={latest} network={network} />
        </div>
      ) : (
        <DataNotice kind="error" title="Data unavailable">Unable to load referenda from Subscan right now.</DataNotice>
      )}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <MyTodo />
        <Panel padding="content">
          <ModuleHeader title="In flight by track" meta={<Link className="text-link" href={withChain("/referenda/tracks/", network)}>All tracks</Link>} />
          {!countsAvailable ? <p className="text-sm text-mute">Per-track activity is not available yet. <Link className="text-link" href={withChain("/referenda/", network, { status: "active" })}>View active referenda</Link></p> : inFlight.length === 0 ? <p className="text-sm text-mute">No referenda are in flight.</p> : (
            <ul className="divide-y divide-line text-sm">
              {inFlight.map((track) => (
                <li key={track.id} className="flex justify-between gap-3 py-2">
                  <Link className="text-link" href={withChain(`/referenda/tracks/${track.id}/`, network)}>{track.displayName}</Link>
                  <span className="num text-mute">{track.activeCount}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
