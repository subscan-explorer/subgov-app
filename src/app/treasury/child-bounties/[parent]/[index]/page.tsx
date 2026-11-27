import type { Metadata } from "next";
import Link from "next/link";
import { Addr, Markdown } from "@/components/gov";
import { DataNotice } from "@/components/data-notice";
import { DetailLayout, MetaItem, MetaList, ModuleHeader, PageHeader, Panel, StatusBadge } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { childBountyPayout, findChildBounty } from "@/lib/child-bounties";
import { activeNetwork } from "@/lib/network-server";
import { optionalGovernance } from "@/lib/subscan-optional";
import { SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import { notFound } from "next/navigation";
import { rowAddress, rowAmountDisplay, rowStatus, rowTitle, type TreasuryRow } from "@/lib/subscan-treasury";

export async function generateMetadata({ params }: { params: Promise<{ parent: string; index: string }> }): Promise<Metadata> {
  const { parent, index } = await params;
  if (![parent, index].every((value) => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)))) notFound();
  return { title: `Child bounty #${parent}-${index}` };
}

export default async function Page({ params, searchParams }: { params: Promise<{ parent: string; index: string }>; searchParams: Promise<{ chain?: string }> }) {
  const { parent, index } = await params;
  const network = await activeNetwork((await searchParams).chain);
  const back = { href: withChain(`/treasury/bounties/${parent}/`, network), label: `Bounty #${parent}` };
  let row: TreasuryRow | undefined;
  let error: string | undefined;
  try {
    row = await findChildBounty<TreasuryRow>(Number(parent), Number(index), SUBSCAN_PAGE_SIZE, async (page) => {
      const result = await optionalGovernance<{ list?: TreasuryRow[]; count?: number }>(network, "scan/bounties/child", { bounties_id: Number(parent), page, row: SUBSCAN_PAGE_SIZE });
      if (!result.available) throw new Error(result.message);
      return result.data;
    });
  } catch (cause) { error = cause instanceof Error ? cause.message : "Child bounties could not be loaded right now."; }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={back} kicker={`Child bounty #${index} · Bounty #${parent}`} title={row ? rowTitle(row, `Child bounty #${index}`) : `Child bounty #${index}`} />
      {error ? <DataNotice kind="error">{error}</DataNotice> : !row ? <DataNotice kind="empty">Child bounty #{index} was not found under bounty #{parent}.</DataNotice> : (
        <>
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={rowStatus(row)} /></div>
          <DetailLayout
            main={<Panel padding="content"><ModuleHeader title="Description" /><Markdown text={String(row.description ?? "On-chain child bounty supplied by Subscan.")} /></Panel>}
            details={
              <Panel padding="compact">
                <ModuleHeader title="Details" />
                <MetaList>
                  <MetaItem label="Beneficiary payout" value={<span className="num">{childBountyPayout(row) != null ? rowAmountDisplay(row, network) : "—"}</span>} />
                  <MetaItem label="Parent bounty" value={<Link className="text-link" href={back.href}>#{parent}</Link>} />
                  <MetaItem label="Curator" value={<Addr address={rowAddress(row, "curator")} />} />
                  <MetaItem label="Beneficiary" value={<Addr address={rowAddress(row, row.beneficiary ? "beneficiary" : "proposer")} />} />
                </MetaList>
                <p className="mt-3 text-xs leading-5 text-mute">{childBountyPayout(row) != null ? "Amount paid to the beneficiary, excluding the curator fee." : "The beneficiary payout amount is not available in the indexed data."}</p>
              </Panel>
            }
          />
        </>
      )}
    </div>
  );
}
