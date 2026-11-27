import type { Metadata } from "next";
import Link from "next/link";
import { DataNotice } from "@/components/data-notice";
import { PageHeader, Panel } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { chains } from "@/lib/chains";
import { formatBlockPeriod, formatBlocks, formatPlanck } from "@/lib/format";
import { activeNetwork } from "@/lib/network-server";
import { liveAvgBlockSeconds } from "@/lib/pubfi";
import { fellowshipLabel, fellowshipSource, fellowshipTracks } from "@/lib/subscan-fellowship";

export const metadata: Metadata = { title: "Fellowship tracks" };

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const network = await activeNetwork((await searchParams).chain);
  const chain = chains.find((item) => item.id === network) ?? chains[0];
  const source = fellowshipSource(network);
  const supported = source !== null;
  const [tracks, secondsPerBlock] = await Promise.all([
    supported ? fellowshipTracks(network).catch(() => null) : Promise.resolve([]),
    source ? liveAvgBlockSeconds(source) : Promise.resolve(null),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: withChain("/fellowship/", network), label: "Fellowship" }}
        kicker={chain.name}
        title="Fellowship tracks"
        description="Decision capacity, deposits, and voting periods for each Technical Fellowship origin. Select a track to view its referenda."
      />
      {!supported ? <DataNotice kind="empty" title={`Fellowship is not available on ${chain.name}`}>This network does not expose the Technical Fellowship collective.</DataNotice>
        : tracks === null ? <DataNotice kind="error">Unable to load Fellowship tracks from Subscan.</DataNotice> : tracks.length === 0 ? <DataNotice kind="empty">No Fellowship track metadata was returned for {chain.name}.</DataNotice> : (
        <Panel className="divide-y divide-line">
          {tracks.map((track) => (
            <Link key={track.id} href={withChain("/fellowship/referenda/", network, { track: track.id })} className="grid gap-3 px-4 py-4 hover:bg-panel-2 focus-visible:outline-2 focus-visible:outline-link sm:px-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <div className="font-semibold"><span className="num mr-2 text-link">#{track.id}</span>{fellowshipLabel(track.name ?? track.track_name) || "Track"}</div>
                <dl className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {([["Prepare", track.prepare_period], ["Decision", track.decision_period], ["Confirm", track.confirm_period]] as const).map(([label, blocks]) => (
                    <div key={label} className="flex gap-1.5">
                      <dt className="text-mute">{label}</dt>
                      <dd><TrackPeriod blocks={blocks} secondsPerBlock={secondsPerBlock} /></dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="text-sm sm:text-right">
                <div>{String(track.current_deciding ?? 0)} / {String(track.max_deciding ?? "—")} deciding</div>
                <div className="mt-1 text-xs text-mute">Deposit {formatPlanck(track.decision_deposit, chain.decimals, chain.symbol)}</div>
              </div>
            </Link>
          ))}
        </Panel>
      )}
    </div>
  );
}

function TrackPeriod({ blocks, secondsPerBlock }: { blocks: unknown; secondsPerBlock: number | null }) {
  const period = formatBlockPeriod(blocks, secondsPerBlock);
  const count = formatBlocks(blocks);
  return (
    <>
      {period}
      {count && count !== period ? <span className="num ml-1 text-mute">({count})</span> : null}
    </>
  );
}
