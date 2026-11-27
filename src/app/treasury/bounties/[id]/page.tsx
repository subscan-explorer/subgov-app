import type { Metadata } from "next";
import { withChain } from "@/lib/chain-query";
import { Addr, Markdown, Timeline } from "@/components/gov";
import { RecordUnavailable } from "@/components/record-unavailable";
import { SubscanLink } from "@/components/subscan-link";
import { formatStatusLabel } from "@/lib/format";
import type { TimelineEvent } from "@/lib/types";
import { notFound } from "next/navigation";
import { DetailLayout, MetaItem, MetaList, ModuleHeader, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { activeNetwork } from "@/lib/network-server";
import { ChildBountyRow } from "@/components/treasury-extra-rows";
import { DataNotice } from "@/components/data-notice";
import { ListPagination } from "@/components/list-pagination";
import { SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import { listOf, optionalGovernance } from "@/lib/subscan-optional";
import { rowAddress, rowAmountDisplay, rowStatus, rowTitle, treasuryLive } from "@/lib/subscan-treasury";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Bounty #${id}` };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chain?: string; page?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const network = await activeNetwork(query.chain);
  const page = /^\d+$/.test(query.page ?? "") ? Math.max(0, Number(query.page) - 1) : 0;
  const back = { href: withChain("/treasury/bounties/", network), label: "Bounties" };
  const loaded = await treasuryLive.bounty(Number(id), network).catch(() => "failed" as const);
  if (loaded === "failed") return <RecordUnavailable title={`Bounty #${id}`} back={back} />;
  if (!loaded || (loaded.proposal_id == null && loaded.bounty_id == null && !loaded.title && !loaded.description)) notFound();
  const b = loaded;
  // The current backend treats parent 0 as an unfiltered global request.
  const childResult = Number(id) === 0
    ? { available: false as const }
    : await optionalGovernance<{ list?: Record<string, unknown>[]; count?: number }>(network, "scan/bounties/child", { bounties_id: Number(id), page, row: SUBSCAN_PAGE_SIZE });
  const children = childResult.available ? listOf<Record<string, unknown>>(childResult.data) : [];
  const childCount = childResult.available ? Number(childResult.data.count ?? children.length) : 0;
  const people = (["curator", "proposer", "beneficiary"] as const).map((key) => ({ key, address: rowAddress(b, key) }));
  const timeline: TimelineEvent[] = Array.isArray(b.timeline)
    ? b.timeline
      .filter((e: Record<string, unknown>) => Number(e.time) > 0)
      .map((e: Record<string, unknown>, i: number) => ({ id: `${e.status ?? "event"}-${e.block ?? i}`, title: formatStatusLabel(String(e.status ?? "Event")), at: new Date(Number(e.time) * 1000).toISOString(), block: Number(e.block ?? 0) }))
    : [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={back} kicker={`Bounty #${id}`} title={rowTitle(b, `Bounty #${id}`)} />
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={rowStatus(b)} />
        <SubscanLink kind="bounty" value={b.proposal_id ?? b.bounty_id ?? id} className="text-xs">
          View on Subscan
        </SubscanLink>
      </div>
      <DetailLayout
        main={
          <>
            <Panel padding="content">
              <ModuleHeader title="Description" />
              <Markdown text={String(b.description ?? "On-chain bounty supplied by Subscan.")} />
            </Panel>
            {timeline.length ? (
              <Panel padding="content">
                <ModuleHeader title="Timeline" />
                <Timeline events={timeline} />
              </Panel>
            ) : null}
            <Panel padding="content">
              <ModuleHeader title="Child bounties" meta={childResult.available ? childCount : undefined} />
              {!childResult.available ? <DataNotice kind="error">{Number(id) === 0 ? "Child bounties for parent #0 require backend filtering support. View them on Subscan." : "Child bounties could not be loaded right now."}</DataNotice>
                : children.length === 0 ? <p className="text-sm text-mute">This bounty has no child bounties.</p>
                  : <div className="-mx-5 divide-y divide-line">{children.map((row, index) => <ChildBountyRow key={index} row={row} network={network} fallbackParent={Number(id)} />)}</div>}
              {childResult.available ? <ListPagination path={`/treasury/bounties/${id}/`} network={network} page={page} totalPages={Math.max(1, Math.ceil(childCount / SUBSCAN_PAGE_SIZE))} /> : null}
            </Panel>
          </>
        }
        details={
          <Panel padding="compact">
            <ModuleHeader title="Details" />
            <MetaList>
              <MetaItem label="Value" value={<span className="num">{rowAmountDisplay(b, network)}</span>} />
              {people.map((item) => (
                <MetaItem key={item.key} label={item.key[0].toUpperCase() + item.key.slice(1)} value={item.address === "—" ? "—" : <Addr address={item.address} />} />
              ))}
            </MetaList>
          </Panel>
        }
      />
    </div>
  );
}
