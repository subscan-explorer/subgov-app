import { listPage } from "@/lib/list-page";
import type { Metadata } from "next";
import { DataNotice } from "@/components/data-notice";
import { ReferendumRow } from "@/components/gov";
import { ListPagination } from "@/components/list-pagination";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { activeChainLabel, activeNetwork } from "@/lib/network-server";
import { liveReferendumDeadlines, liveReferenda, liveTracks } from "@/lib/subscan-data";
import { ReferendaBrowser } from "@/components/referenda-browser";
import { SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "deciding", label: "Deciding" },
  { key: "preparing", label: "Preparing" },
  { key: "confirming", label: "Confirming" },
  { key: "executed", label: "Executed" },
  { key: "executedfailed", label: "Executed failed" },
  { key: "rejected", label: "Rejected" },
  { key: "cancelled", label: "Cancelled" },
  { key: "timedout", label: "Timed out" },
  { key: "killed", label: "Killed" },
] as const;

export const metadata: Metadata = { title: "Referenda" };

export default async function ReferendaPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; chain?: string; status?: string; track?: string }>;
}) {
  const params = await searchParams;
  const page = listPage(params.page);
  const row = SUBSCAN_PAGE_SIZE;
  const status = params.status && FILTERS.some((f) => f.key === params.status) ? params.status : "all";
  const network = await activeNetwork(params.chain);
  const chain = await activeChainLabel();
  const trackParam = Number(params.track);
  const track = params.track && Number.isSafeInteger(trackParam) && trackParam >= 0 ? trackParam : null;
  const tracksPromise = liveTracks(network).catch(() => []);
  const referendaPromise = (async () => {
    const origin = track === null ? undefined : (await tracksPromise).find((item) => item.id === track)?.name;
    if (track !== null && !origin) throw new Error("Selected track is unavailable for this network.");
    return liveReferenda(network, { page, row, status: status === "all" ? undefined : status, origin });
  })();
  const [result, tracks] = await Promise.all([
    referendaPromise
      .then((value) => ({ data: value, error: "" }))
      .catch((cause: unknown) => ({ data: null, error: cause instanceof Error ? cause.message : "Unable to load referenda" })),
    tracksPromise,
  ]);
  const { data, error } = result;
  const deadlines = data ? await liveReferendumDeadlines(data.rows, tracks, network) : new Map<number, string>();
  const extra = { status: status === "all" ? undefined : status, track: track ?? undefined };
  const totalPages = data ? Math.max(1, Math.ceil(data.count / row)) : 1;
  const currentPage = page + 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker={`${chain} · live`}
        title="Referenda"
        description={
          data
            ? `Live referenda from Subscan · ${data.count.toLocaleString()} in this view.`
            : "Live referenda from Subscan."
        }
        actions={
          <ButtonLink
            href={withChain("/referenda/new/", network)}
          >
            New proposal
          </ButtonLink>
        }
      />
      <ReferendaBrowser
        filters={[...FILTERS]}
        status={status}
        tracks={tracks.map((t) => ({ id: t.id, label: t.displayName }))}
        track={track}
      >
        <div className="flex flex-col gap-4">
          {!error && data && data.rows.length >= 10 ? <ListPagination path="/referenda/" network={network} page={page} totalPages={totalPages} extra={extra} compact /> : null}
          {error ? <DataNotice kind="error" title="Data unavailable">{error}</DataNotice> : null}
          {!error ? (
            data?.rows.length ? <Panel className="divide-y divide-line">
              {data.rows.map((r) => <ReferendumRow key={r.id} r={r} deadline={deadlines.get(r.id)} />)}
            </Panel> : <DataNotice kind="empty">No records found for this filter. Choose another status or track to see more referenda.</DataNotice>
          ) : null}
          {!error && data ? <ListPagination path="/referenda/" network={network} page={page} totalPages={totalPages} extra={extra} /> : null}
        </div>
      </ReferendaBrowser>
    </div>
  );
}
