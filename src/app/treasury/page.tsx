import type { Metadata } from "next";
import { DataNotice } from "@/components/data-notice";
import { ReferendumRow } from "@/components/gov";
import { PageHeader, Panel, SectionHeader, StatStrip } from "@/components/ui";
import { BountyRow, SpendRow } from "@/components/treasury-rows";
import { withChain } from "@/lib/chain-query";
import { chains } from "@/lib/chains";
import { activeNetwork } from "@/lib/network-server";
import { liveReferendumDeadlines, liveReferenda, liveTracks } from "@/lib/subscan-data";
import { treasuryLive } from "@/lib/subscan-treasury";
import { TreasuryOnChain } from "@/components/treasury-onchain";
import Link from "next/link";

export const metadata: Metadata = { title: "Treasury" };

export default async function TreasuryPage({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const network = await activeNetwork((await searchParams).chain);
  const chain = chains.find((item) => item.id === network) ?? chains[0];

  const [spendsPage, bountiesPage, treasuryReferenda, tracks] = await Promise.all([
    treasuryLive.spendsPage(network, { page: 0, row: 10 }).catch(() => null),
    treasuryLive.bountiesPage(network, { page: 0, row: 10 }).catch(() => null),
    liveReferenda(network, { status: "deciding", row: 5 }).catch(() => null),
    liveTracks(network).catch(() => []),
  ]);

  const spends = spendsPage?.rows ?? [];
  const bounties = bountiesPage?.rows ?? [];
  const treasuryCalls = (treasuryReferenda?.rows ?? []).filter((r) => r.call.startsWith("Treasury."));
  const deadlines = await liveReferendumDeadlines(treasuryCalls, tracks, network);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        kicker={chain.name}
        title="Treasury"
        description="Live on-chain treasury spends and bounties from Subscan."
      />
      <TreasuryOnChain />
      <nav aria-label="More treasury records" className="flex flex-wrap gap-2 text-sm">
        {([["/treasury/child-bounties/", "Child bounties"], ["/treasury/multiasset-bounties/", "Multi-asset bounties"], ["/treasury/proposals/", "Legacy proposals"], ["/treasury/tips/", "Tips"], ["/treasury/burns/", "Burns"], ["/calendar/", "Calendar"]] as const).map(([href, label]) => (
          <Link key={href} href={withChain(href, network)} className="rounded-full bg-panel px-4 py-2 text-mute hover:text-paper">{label}</Link>
        ))}
      </nav>
      <StatStrip
        items={[
          { label: "Spends on record", value: spendsPage?.count ?? "—" },
          { label: "Bounties on record", value: bountiesPage?.count ?? "—" },
          { label: "Treasury calls in latest deciding referenda", value: treasuryReferenda ? treasuryCalls.length : "—", hint: "Among the 5 most recent deciding referenda" },
        ]}
      />
      <section>
        <SectionHeader title="Recent treasury referenda in decision" action={{ href: withChain("/referenda/", network, { status: "deciding" }), label: "All deciding" }} />
        {treasuryReferenda === null ? (
          <DataNotice kind="error">Deciding referenda could not be loaded right now.</DataNotice>
        ) : treasuryCalls.length ? (
          <Panel className="divide-y divide-line">
            {treasuryCalls.map((r) => <ReferendumRow key={r.id} r={r} deadline={deadlines.get(r.id)} />)}
          </Panel>
        ) : (
          <DataNotice kind="empty" title="No treasury calls in this sample">No treasury calls appear among the 5 most recent deciding referenda.</DataNotice>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="min-w-0">
          <SectionHeader title="Recent spends" action={{ href: withChain("/treasury/spends/", network), label: "All spends" }} />
          {spendsPage === null ? (
            <DataNotice kind="error">Spends could not be loaded right now.</DataNotice>
          ) : spends.length ? (
            <Panel className="divide-y divide-line">
              {spends.slice(0, 5).map((s, i) => <SpendRow key={s.id ?? s.proposal_id ?? i} row={s} index={i} network={network} />)}
            </Panel>
          ) : (
            <DataNotice kind="empty" title="No spends">No treasury spends are indexed for {chain.name}.</DataNotice>
          )}
        </section>
        <section className="min-w-0">
          <SectionHeader title="Recent bounties" action={{ href: withChain("/treasury/bounties/", network), label: "All bounties" }} />
          {bountiesPage === null ? (
            <DataNotice kind="error">Bounties could not be loaded right now.</DataNotice>
          ) : bounties.length ? (
            <Panel className="divide-y divide-line">
              {bounties.slice(0, 5).map((b, i) => <BountyRow key={b.proposal_id ?? b.id ?? b.bounty_id ?? i} row={b} index={i} network={network} />)}
            </Panel>
          ) : (
            <DataNotice kind="empty" title="No bounties">No bounties are indexed for {chain.name}.</DataNotice>
          )}
        </section>
      </div>
    </div>
  );
}
