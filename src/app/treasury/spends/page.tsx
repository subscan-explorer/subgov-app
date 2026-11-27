import { listPage } from "@/lib/list-page";
import type { Metadata } from "next";
import { DataNotice } from "@/components/data-notice";
import { PageHeader, Panel } from "@/components/ui";
import { SpendRow } from "@/components/treasury-rows";
import { ListPagination } from "@/components/list-pagination";
import { withChain } from "@/lib/chain-query";
import { chains } from "@/lib/chains";
import { activeNetwork } from "@/lib/network-server";
import { SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import { treasuryLive } from "@/lib/subscan-treasury";
import { relaySpendSource, spendSource } from "@/lib/treasury-history";
import Link from "next/link";

export const metadata: Metadata = { title: "Treasury spends" };

export default async function SpendsPage({ searchParams }: { searchParams: Promise<{ chain?: string; page?: string; source?: string }> }) {
  const params = await searchParams;
  const network = await activeNetwork(params.chain);
  const chain = chains.find((item) => item.id === network) ?? chains[0];
  const page = listPage(params.page);
  const row = SUBSCAN_PAGE_SIZE;
  const source = spendSource(params.source);
  const hasRelay = relaySpendSource(network) !== null;

  let data;
  try {
    data = await treasuryLive.spendsPage(network, { page, row, source });
  } catch {
    data = null;
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.count / row)) : 1;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={`${chain.name} · Treasury`} title="Treasury spends" description={hasRelay ? "OpenGov treasury spends, including multi-asset payouts and Relay chain history." : "OpenGov treasury spends, including multi-asset payouts."} />
      {hasRelay ? <nav aria-label="Spend history source" className="flex flex-wrap gap-2">
        {([["all", "All spends"], ["current", "Asset Hub"], ["relay", "Relay history"]] as const).map(([value, label]) => (
          <Link key={value} href={withChain("/treasury/spends/", network, { source: value })} aria-current={source === value ? "page" : undefined}
            className={source === value ? "rounded-full bg-paper px-4 py-2 text-sm text-ink" : "rounded-full bg-panel px-4 py-2 text-sm text-mute hover:text-paper"}>{label}</Link>
        ))}
      </nav> : null}
      {data ? <p className="text-xs text-mute">{data.count.toLocaleString("en-US")} spends{source === "all" && hasRelay ? " · Asset Hub and Relay history" : ""}</p> : null}
      {data === null ? (
        <DataNotice kind="error">Unable to load treasury spends right now.{hasRelay && source === "all" ? " You can also view Asset Hub or Relay history separately." : ""}</DataNotice>
      ) : data.rows.length === 0 ? (
        <DataNotice kind="empty" title={data.count ? "No spends on this page" : "No spends"}>
          {data.count ? <>This page is outside the available history. <Link className="text-link" href={withChain("/treasury/spends/", network, { source })}>Return to the first page</Link>.</> : "No treasury spends are indexed for this source."}
        </DataNotice>
      ) : (
        <>
          {data.rows.length >= 10 ? <ListPagination path="/treasury/spends/" network={network} page={page} totalPages={totalPages} extra={{ source }} compact /> : null}
          <Panel className="divide-y divide-line">
            {data.rows.map((s, i) => <SpendRow key={s.id ?? s.proposal_id ?? i} row={s} index={i} network={network} />)}
          </Panel>
          <ListPagination path="/treasury/spends/" network={network} page={page} totalPages={totalPages} extra={{ source }} />
        </>
      )}
    </div>
  );
}
