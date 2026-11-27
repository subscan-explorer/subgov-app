import { listPage } from "@/lib/list-page";
import type { Metadata } from "next";
import Link from "next/link";
import { DataNotice } from "@/components/data-notice";
import { ListPagination } from "@/components/list-pagination";
import { PendingBackend } from "@/components/pending-backend";
import { ChildBountyRow } from "@/components/treasury-extra-rows";
import { ChoiceGroup, PageHeader, Panel } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { activeNetwork } from "@/lib/network-server";
import { SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import { listOf, optionalGovernance } from "@/lib/subscan-optional";
import type { TreasuryRow } from "@/lib/subscan-treasury";

export const metadata: Metadata = { title: "Child bounties" };

const STATUSES = ["all", "active", "historical"] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string; page?: string; status?: string }> }) {
  const query = await searchParams;
  const network = await activeNetwork(query.chain);
  const chain = governanceChains[network];
  const page = listPage(query.page);
  const status = STATUSES.find((value) => value === query.status) ?? "all";
  // A global list (no `bounties_id`) is requested in subgov#106; the per-bounty list already works.
  // Older backends ignore `status`, returning the unfiltered list with a success code.
  const result = status !== "all"
    ? { available: false as const, reason: "pending" as const, message: "Filtering child bounties by status requires backend support." }
    : await optionalGovernance<{ list?: TreasuryRow[]; count?: number }>(network, "scan/bounties/child", { page, row: SUBSCAN_PAGE_SIZE }, { pendingOnCodeError: true });
  const rows = result.available ? listOf<TreasuryRow>(result.data) : [];
  const totalPages = result.available ? Math.max(1, Math.ceil(Number(result.data.count ?? rows.length) / SUBSCAN_PAGE_SIZE)) : 1;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: withChain("/treasury/bounties/", network), label: "Bounties" }} kicker={`${chain.name} · Treasury`} title="Child bounties" description="Work split out of parent bounties and paid by their curators." />
      <ChoiceGroup aria-label="Child bounty status">
        {STATUSES.map((value) => (
          <Link key={value} href={withChain("/treasury/child-bounties/", network, { status: value === "all" ? undefined : value })} aria-current={value === status ? "page" : undefined}
            className={value === status ? "rounded-full bg-paper px-4 py-2 text-sm text-ink" : "rounded-full bg-panel px-4 py-2 text-sm text-mute hover:text-paper"}>
            {value === "all" ? "All" : value === "active" ? "Active" : "History"}
          </Link>
        ))}
      </ChoiceGroup>
      {!result.available ? (
        <>
          <PendingBackend result={result} issue={106} what="The list of all child bounties" />
          <DataNotice kind="empty">Open a parent bounty to see its child bounties in the meantime.</DataNotice>
        </>
      ) : rows.length === 0 ? <DataNotice kind="empty" title="No child bounties">No child bounties are indexed for {chain.name}.</DataNotice> : (
        <>
          <Panel className="divide-y divide-line">{rows.map((row, index) => <ChildBountyRow key={index} row={row} network={network} />)}</Panel>
          <ListPagination path="/treasury/child-bounties/" network={network} page={page} totalPages={totalPages} extra={{ status: status === "all" ? undefined : status }} />
        </>
      )}
    </div>
  );
}
