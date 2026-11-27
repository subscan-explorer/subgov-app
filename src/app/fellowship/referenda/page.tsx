import type { Metadata } from "next";
import { DataNotice } from "@/components/data-notice";
import { ReferendaBrowser } from "@/components/referenda-browser";
import { ListPagination } from "@/components/list-pagination";
import { SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import { PageHeader, Panel, RecordRow, StatusBadge } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { chains } from "@/lib/chains";
import { activeNetwork } from "@/lib/network-server";
import { fellowshipLabel, fellowshipTracks, fellowshipId, fellowshipReferendums, fellowshipSource, fellowshipStatus, fellowshipTitle } from "@/lib/subscan-fellowship";

export const metadata: Metadata = { title: "Fellowship referenda" };

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string; page?: string; track?: string }> }) {
  const params = await searchParams;
  const network = await activeNetwork(params.chain);
  const chain = chains.find((item) => item.id === network) ?? chains[0];
  const supported = fellowshipSource(network) !== null;
  const requested = Number(params.page ?? "1");
  const page = Number.isSafeInteger(requested) && requested > 0 ? requested - 1 : 0;
  const trackId = Number(params.track);
  const track = params.track && Number.isSafeInteger(trackId) && trackId >= 0 ? trackId : null;
  const tracks = supported ? await fellowshipTracks(network).catch(() => []) : [];
  const selectedTrack = tracks.find((item) => item.id === track);
  const extra = { track: track ?? undefined };
  let rows = null;
  let count = 0;
  try {
    if (supported && track !== null && !selectedTrack) throw new Error("Selected track is unavailable");
    const result = supported ? await fellowshipReferendums(network, page, selectedTrack) : { rows: [], count: 0 };
    rows = result.rows;
    count = result.count;
  } catch { rows = null; }
  const totalPages = Math.max(1, Math.ceil(count / SUBSCAN_PAGE_SIZE));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: withChain("/fellowship/", network), label: "Fellowship" }}
        kicker={chain.name}
        title="Fellowship referenda"
        description={rows ? `Technical Fellowship decisions indexed from the network that hosts the collective. ${count.toLocaleString()} referenda.` : "Technical Fellowship decisions indexed from the network that hosts the collective."}
      />
      <ReferendaBrowser
        path="/fellowship/referenda/"
        filters={[]}
        status="all"
        tracks={tracks.map((item) => ({ id: item.id, label: `#${item.id} ${fellowshipLabel(item.name ?? item.track_name) || "Track"}` }))}
        track={track}
      >
        {!supported ? <DataNotice kind="empty" title={`Fellowship is not available on ${chain.name}`}>This network does not expose the Technical Fellowship collective.</DataNotice>
          : rows === null ? <DataNotice kind="error">Unable to load Fellowship referenda for this track. Retry or select another track.</DataNotice> : rows.length === 0 ? <DataNotice kind="empty">No Fellowship referenda were returned for {track !== null ? "this track" : chain.name}.</DataNotice> : (
          <>
          <ListPagination path="/fellowship/referenda/" network={network} page={page} totalPages={totalPages} extra={extra} compact />
          <Panel className="divide-y divide-line">
            {rows.map((r) => (
              <RecordRow
                key={fellowshipId(r)}
                href={withChain(`/fellowship/referenda/${fellowshipId(r)}/`, network)}
                id={`#${fellowshipId(r)}`}
                badges={<StatusBadge status={fellowshipStatus(r)} />}
                title={fellowshipTitle(r, `Referendum #${fellowshipId(r)}`)}
                meta={r.call_module || r.call_name ? <span className="num">{String(r.call_module ?? "Unknown")}.{String(r.call_name ?? "call")}</span> : undefined}
              />
            ))}
          </Panel>
          </>
        )}
        {rows && rows.length ? <ListPagination path="/fellowship/referenda/" network={network} page={page} totalPages={totalPages} extra={extra} /> : null}
      </ReferendaBrowser>
    </div>
  );
}
