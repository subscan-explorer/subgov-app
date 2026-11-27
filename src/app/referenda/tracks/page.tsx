import type { Metadata } from "next";
import Link from "next/link";
import { DataNotice } from "@/components/data-notice";
import { PageHeader, Panel } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { formatBlockPeriod, formatPlanck } from "@/lib/format";
import { activeNetwork } from "@/lib/network-server";
import { liveGovernanceBlockSeconds } from "@/lib/governance-clock-server";
import { liveTracks } from "@/lib/subscan-data";

export const metadata: Metadata = { title: "OpenGov tracks" };

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const network = await activeNetwork((await searchParams).chain);
  const chain = governanceChains[network];
  const [tracks, secondsPerBlock] = await Promise.all([
    liveTracks(network).catch(() => null),
    liveGovernanceBlockSeconds(network),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: withChain("/referenda/", network), label: "Referenda" }}
        kicker={chain.name}
        title="OpenGov tracks"
        description="Every OpenGov origin with its capacity, deposit and voting periods. Select a track for its curves, statistics and referenda."
      />
      {tracks === null ? <DataNotice kind="error">Unable to load tracks from Subscan.</DataNotice> : tracks.length === 0 ? <DataNotice kind="empty">No tracks were returned for {chain.name}.</DataNotice> : (
        <Panel className="divide-y divide-line">
          {tracks.map((track) => (
            <Link key={track.id} href={withChain(`/referenda/tracks/${track.id}/`, network)} className="grid gap-3 px-4 py-4 hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-link sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
              <div className="min-w-0">
                <div className="font-semibold"><span className="num mr-2 text-paper">#{track.id}</span>{track.displayName}</div>
                <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {([["Prepare", track.preparePeriod], ["Decision", track.decisionPeriod], ["Confirm", track.confirmPeriod], ["Enactment", track.minEnactmentPeriod]] as const).map(([label, blocks]) => (
                    <div key={label} className="flex gap-1.5"><dt className="text-mute">{label}</dt><dd>{formatBlockPeriod(blocks, secondsPerBlock)}</dd></div>
                  ))}
                </dl>
              </div>
              <div className="text-sm sm:text-right">
                <div>{track.activeCount == null ? "Activity unavailable" : `${track.activeCount.toLocaleString()} active`} · max {track.maxDeciding || "—"} deciding</div>
                <div className="mt-1 text-xs text-mute">Deposit {formatPlanck(track.decisionDeposit, chain.decimals, chain.symbol)}</div>
              </div>
            </Link>
          ))}
        </Panel>
      )}
    </div>
  );
}
