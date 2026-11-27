import { listPage } from "@/lib/list-page";
import type { Metadata } from "next";
import Link from "next/link";
import { AccountLink } from "@/components/account-link";
import { DataNotice } from "@/components/data-notice";
import { ListPagination } from "@/components/list-pagination";
import { PendingBackend } from "@/components/pending-backend";
import { PageHeader, Panel } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { formatBaseUnits, formatDate } from "@/lib/format";
import { activeNetwork } from "@/lib/network-server";
import { SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import { liveTracks } from "@/lib/subscan-data";
import { addressOf, listOf, optionalGovernance } from "@/lib/subscan-optional";
import { formatOriginName } from "@/lib/referendum-tracks";

export const metadata: Metadata = { title: "Votes" };

type FeedVote = { account?: unknown; status?: string; amount?: string; votes?: string; conviction?: string | number; referendum_index?: number; origin?: string; block_timestamp?: number; voting_time?: number; extrinsic_index?: string };

const SIDES = [{ key: "all", label: "All" }, { key: "Ayes", label: "Aye" }, { key: "Nays", label: "Nay" }, { key: "Abstains", label: "Abstain" }] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string; track?: string; side?: string; page?: string }> }) {
  const query = await searchParams;
  const network = await activeNetwork(query.chain);
  const chain = governanceChains[network];
  const page = listPage(query.page);
  const side = SIDES.find((item) => item.key === query.side)?.key ?? "all";
  const tracks = await liveTracks(network).catch(() => []);
  const track = tracks.find((item) => String(item.id) === query.track);
  // Account- and referendum-less scan/referenda/votes with `origin` is requested in subgov#98.
  const result = await optionalGovernance<{ list?: FeedVote[]; count?: number }>(network, "scan/referenda/votes", {
    page, row: SUBSCAN_PAGE_SIZE, valid: "valid", order: "desc",
    ...(track ? { origin: track.name } : {}),
    ...(side !== "all" ? { status: side } : {}),
  }, { pendingOnCodeError: true });
  const rows = result.available ? listOf<FeedVote>(result.data) : [];
  const count = result.available ? Number(result.data.count ?? rows.length) : 0;
  const href = (extra: Record<string, string | number | undefined>) => withChain("/votes/", network, { track: track?.id, side: side === "all" ? undefined : side, ...extra });
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={chain.name} title="Votes" description="The latest conviction votes across every OpenGov referendum. Times are UTC." />
      <div className="flex flex-wrap gap-2">
        {SIDES.map((item) => (
          <Link key={item.key} href={href({ side: item.key === "all" ? undefined : item.key, page: undefined })} aria-current={item.key === side ? "page" : undefined}
            className={item.key === side ? "rounded-full bg-paper px-4 py-2 text-sm text-ink" : "rounded-full bg-panel px-4 py-2 text-sm text-mute hover:text-paper"}>{item.label}</Link>
        ))}
        <span className="mx-1 self-center text-line-2">|</span>
        <Link href={href({ track: undefined, page: undefined })} className={!track ? "rounded-full bg-paper px-4 py-2 text-sm text-ink" : "rounded-full bg-panel px-4 py-2 text-sm text-mute hover:text-paper"}>All tracks</Link>
        {tracks.map((item) => (
          <Link key={item.id} href={href({ track: item.id, page: undefined })} className={item.id === track?.id ? "rounded-full bg-paper px-4 py-2 text-sm text-ink" : "rounded-full bg-panel px-4 py-2 text-sm text-mute hover:text-paper"}>{item.displayName}</Link>
        ))}
      </div>
      {!result.available ? <PendingBackend result={result} issue={98} what="The network-wide vote feed" /> : rows.length === 0 ? <DataNotice kind="empty">No votes match these filters.</DataNotice> : (
        <>
          <Panel className="divide-y divide-line">
            {rows.map((row, index) => {
              const who = addressOf(row.account);
              const time = row.block_timestamp ?? row.voting_time;
              const sideLabel = /aye/i.test(row.status ?? "") ? "Aye" : /nay/i.test(row.status ?? "") ? "Nay" : "Abstain";
              return (
                <div key={`${row.extrinsic_index ?? index}-${who?.address ?? ""}-${sideLabel}`} className="grid gap-2 px-5 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    {who ? <AccountLink network={network} address={who.address} display={who.display} /> : "—"}
                    <span className={sideLabel === "Aye" ? "ml-2 text-success-text" : sideLabel === "Nay" ? "ml-2 text-error-text" : "ml-2 text-mute"}>{sideLabel}</span>
                    <span className="ml-2 text-mute">on</span>
                    {row.referendum_index != null ? <Link className="ml-1 text-link" href={withChain(`/referenda/${row.referendum_index}/`, network)}>#{row.referendum_index}</Link> : null}
                    {row.origin ? <span className="ml-2 text-xs text-mute">{formatOriginName(row.origin)}</span> : null}
                  </div>
                  <div className="num text-right text-xs text-mute">
                    <span className="text-sm text-paper">{formatBaseUnits(String(row.amount ?? row.votes ?? "0"), chain.decimals) ?? "—"} {chain.symbol}</span>
                    {sideLabel !== "Abstain" && row.conviction != null ? ` · ${Number(row.conviction) === 0 ? "0.1" : row.conviction}x` : ""}
                    {time ? ` · ${formatDate(new Date(time * 1000).toISOString())}` : ""}
                  </div>
                </div>
              );
            })}
          </Panel>
          <ListPagination path="/votes/" network={network} page={page} totalPages={Math.max(1, Math.ceil(count / SUBSCAN_PAGE_SIZE))} extra={{ track: track?.id, side: side === "all" ? undefined : side }} />
        </>
      )}
    </div>
  );
}
