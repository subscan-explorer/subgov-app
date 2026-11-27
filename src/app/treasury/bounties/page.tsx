import { listPage } from "@/lib/list-page";
import type { Metadata } from "next";
import { DataNotice } from "@/components/data-notice";
import { ButtonLink, PageHeader, Panel } from "@/components/ui";
import { BountyRow } from "@/components/treasury-rows";
import { ListPagination } from "@/components/list-pagination";
import { withChain } from "@/lib/chain-query";
import { activeNetwork } from "@/lib/network-server";
import { SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import { isBountyStatusFilter, treasuryLive } from "@/lib/subscan-treasury";

export const metadata: Metadata = { title: "Bounties" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "historical", label: "Historical" },
] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string; page?: string; status?: string }> }) {
  const params = await searchParams;
  const network = await activeNetwork(params.chain);
  const page = listPage(params.page);
  const row = SUBSCAN_PAGE_SIZE;
  const status = isBountyStatusFilter(params.status) ? params.status : undefined;
  const extra = { status };

  let data;
  try {
    data = await treasuryLive.bountiesPage(network, { page, row, ...(status ? { status } : {}) });
  } catch {
    data = null;
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.count / row)) : 1;
  const current = status ?? "all";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker="Treasury" title="Bounties" />
      <div role="group" aria-label="Filter by status" className="filter-row">
        {FILTERS.map((f) => (
          <ButtonLink
            key={f.key}
            size="sm"
            variant={current === f.key ? "brass" : "ghost"}
            aria-current={current === f.key ? "page" : undefined}
            href={withChain("/treasury/bounties/", network, { status: f.key === "all" ? undefined : f.key })}
            scroll={false}
          >
            {f.label}
          </ButtonLink>
        ))}
      </div>
      {data === null ? (
        <DataNotice kind="error">Unable to load bounties right now.</DataNotice>
      ) : data.rows.length === 0 ? (
        status
          ? <DataNotice kind="empty">No bounties for this filter.</DataNotice>
          : <DataNotice kind="empty" title="No bounties">No bounties are indexed for this network.</DataNotice>
      ) : (
        <>
          {data.rows.length >= 10 ? <ListPagination path="/treasury/bounties/" network={network} page={page} totalPages={totalPages} extra={extra} compact /> : null}
          <Panel className="divide-y divide-line">
            {data.rows.map((b, i) => <BountyRow key={b.proposal_id ?? b.id ?? b.bounty_id ?? i} row={b} index={i} network={network} />)}
          </Panel>
          <ListPagination path="/treasury/bounties/" network={network} page={page} totalPages={totalPages} extra={extra} />
        </>
      )}
    </div>
  );
}
