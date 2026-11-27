import { Addr, Timeline } from "@/components/gov";
import { ArrowLink, Badge, DetailLayout, MetaItem, MetaList, ModuleHeader, PageHeader, Panel } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import type { SubscanNetwork } from "@/lib/pubfi";
import { rowAddress, rowAmountDisplay, rowStatus, rowTitle, type TreasuryRow } from "@/lib/subscan-treasury";
import type { TimelineEvent } from "@/lib/types";
import Link from "next/link";
import { SpendActions, SpendDetailStatus, SpendStateProvider } from "@/components/treasury-onchain";
import { isRelaySpend } from "@/lib/treasury-history";
import { ReferendumPost } from "@/components/referendum-post";
import { subsquareUrl } from "@/lib/governance-source";
import type { GovernancePost } from "@/lib/subscan-data";

export function SpendView({ spend: s, network, post }: { spend: TreasuryRow; network?: SubscanNetwork; post?: GovernancePost | null }) {
  const chain = network === "kusama" || network === "paseo" ? network : "polkadot";
  const back = { href: withChain("/treasury/spends/", chain), label: "Treasury spends" };

  const id = s.proposal_id ?? s.id;
  const title = rowTitle(s, `Treasury spend #${id ?? "—"}`);
  const content = post?.content || String(s.content ?? s.description ?? (post === null ? "The proposal description could not be loaded right now." : "No proposal description is available from Subscan."));
  const timeline = mapTimeline(s);
  const historical = isRelaySpend(s);
  const explorer = s.sourceNetwork ? `https://${s.sourceNetwork}.subscan.io` : undefined;

  const view = <div className="flex flex-col gap-6">
        <PageHeader back={back} kicker={id != null ? `Treasury spend #${id}` : "Treasury spend"} title={title} />
        <div className="flex flex-wrap items-center gap-2">
          <SpendDetailStatus status={rowStatus(s)} />
          {historical ? <Badge>Relay history</Badge> : null}
          {explorer ? <ArrowLink href={`${explorer}/treasury_spend/${id}`} external size="sm">View on Subscan</ArrowLink> : null}
        </div>
        <DetailLayout
          main={<>
            <ReferendumPost content={content} sourceBadge={post?.source ? `${post.source} · via Subscan` : undefined} sourceUrl={subsquareUrl(chain, "treasury_spend", Number(id))} />
            {timeline.length ? (
              <Panel padding="content">
                <ModuleHeader title="Timeline" />
                <Timeline events={timeline} explorer={explorer} />
              </Panel>
            ) : null}
          </>}
          details={
            <Panel padding="compact">
              <ModuleHeader title="Details" />
              <MetaList>
                <MetaItem label="Amount" value={<span className="num">{rowAmountDisplay(s, network)}</span>} />
                <MetaItem label="Proposer" value={<Addr address={rowAddress(s, "proposer")} />} />
                <MetaItem label="Beneficiary" value={<Addr address={rowAddress(s, "beneficiary")} />} />
                {s.referendum_id ? (
                  <MetaItem
                    label="Referendum"
                    value={<Link href={withChain(`/referenda/${s.referendum_id}/`, chain)} className="text-link">#{s.referendum_id}</Link>}
                  />
                ) : null}
              </MetaList>
              {historical ? <p className="mt-4 border-t border-line pt-4 text-xs leading-5 text-mute">Historical Relay chain record. Payment delivery is not checked here.</p> : id != null && Number.isInteger(Number(id)) ? <div className="mt-4 border-t border-line pt-4"><SpendActions index={Number(id)} /></div> : null}
            </Panel>
          }
        />
      </div>;
  return historical ? view : <SpendStateProvider index={Number(id)}>{view}</SpendStateProvider>;
}

function mapTimeline(row: TreasuryRow): TimelineEvent[] {
  if (!Array.isArray(row.timeline)) return [];
  // Events without a timestamp would render as 1970 — leave them out.
  return row.timeline.filter((e: Record<string, unknown>) => Number(e.time) > 0).map((e: Record<string, unknown>, i: number) => ({
    id: `${e.status ?? "event"}-${e.block ?? i}`,
    title: String(e.status ?? "Event"),
    at: e.time ? new Date(Number(e.time) * 1000).toISOString() : new Date(0).toISOString(),
    block: Number(e.block ?? 0),
  }));
}
