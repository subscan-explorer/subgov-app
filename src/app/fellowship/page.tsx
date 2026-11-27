import type { Metadata } from "next";
import { DataNotice } from "@/components/data-notice";
import { ArrowLink, Empty, PageHeader, Panel, SectionHeader, StatStrip } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { chains } from "@/lib/chains";
import { activeNetwork } from "@/lib/network-server";
import { fellowshipSource, fellowshipStatistics, originLabel, originRows } from "@/lib/subscan-fellowship";

export const metadata: Metadata = { title: "Fellowship" };

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const network = await activeNetwork((await searchParams).chain);
  const chain = chains.find((item) => item.id === network) ?? chains[0];
  const supported = fellowshipSource(network) !== null;
  let stats;
  try { stats = supported ? await fellowshipStatistics(network) : undefined; } catch { stats = undefined; }
  const origins = stats ? originRows(stats) : [];
  const hasActivity = Boolean(stats && ["fellowship_members", "active_fellowship_members", "voting_total", "confirm_total", "OriginsCount"].some((key) => Number(stats[key] ?? 0) > 0));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={chain.name} title="Fellowship" description="Technical Fellowship membership and origin activity indexed by Subscan." />
      {!supported ? <DataNotice kind="empty" title={`Fellowship is not available on ${chain.name}`}>This network does not expose the Technical Fellowship collective.</DataNotice>
        : !stats ? <DataNotice kind="error">Unable to load fellowship statistics.</DataNotice> : (
        !hasActivity ? <Empty>No Fellowship activity is indexed for {chain.name}.</Empty> : <>
          <StatStrip
            items={[
              { label: "Members", value: String(stats.fellowship_members ?? "—") },
              { label: "Active voters", value: String(stats.active_fellowship_members ?? "—"), hint: "Distinct voters in the past month" },
              { label: "Voting", value: String(stats.voting_total ?? "—") },
              { label: "Confirming", value: String(stats.confirm_total ?? "—") },
            ]}
          />
          <p className="text-xs text-mute">Activity and statuses are indexed by Subscan and may lag the chain.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <ArrowLink href={withChain("/fellowship/referenda/", network)}>Referenda</ArrowLink>
            <ArrowLink href={withChain("/fellowship/tracks/", network)}>Tracks</ArrowLink>
          </div>
          {origins.length > 0 ? (
            <section>
            <SectionHeader title="Origins" />
            <Panel className="divide-y divide-line">
              {origins.map((o, i) => (
                <div key={String(o.ID ?? i)} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="min-w-0 break-words">{originLabel(o, `Origin ${o.ID ?? i}`)}</span>
                  <span className="num text-mute">{String(o.Count ?? 0)}</span>
                </div>
              ))}
            </Panel>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
