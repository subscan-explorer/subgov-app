import type { Metadata } from "next";
import { AccountLink } from "@/components/account-link";
import { BarList, PendingBackend } from "@/components/pending-backend";
import { ModuleHeader, PageHeader, Panel, StatStrip } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { formatBaseUnits } from "@/lib/format";
import { activeNetwork } from "@/lib/network-server";
import { formatOriginName } from "@/lib/referendum-tracks";
import { addressOf, optionalGovernance } from "@/lib/subscan-optional";

export const metadata: Metadata = { title: "Delegation statistics" };

type Stats = {
  total_delegated_capital?: string; total_delegated_votes?: string; delegators?: number; delegates?: number;
  by_origin?: { origin: string; capital?: string; votes?: string; delegators?: number }[];
  top_delegates?: { account?: unknown; votes?: string; delegators?: number }[];
  decimals?: number; symbol?: string;
};

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const network = await activeNetwork((await searchParams).chain);
  const chain = governanceChains[network];
  // Endpoint requested in subgov#103.
  const result = await optionalGovernance<Stats>(network, "scan/referenda/delegation/statistics", {});
  const data = result.available ? result.data : null;
  const decimals = data?.decimals ?? chain.decimals;
  const symbol = data?.symbol ?? chain.symbol;
  const amount = (value?: string) => (value ? `${formatBaseUnits(value, decimals) ?? value} ${symbol}` : "—");
  const big = (value?: string) => { try { return BigInt(value ?? "0"); } catch { return BigInt(0); } };
  const maxVotes = data?.by_origin?.reduce((m, row) => (big(row.votes) > m ? big(row.votes) : m), BigInt(1)) ?? BigInt(1);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: withChain("/delegation/", network), label: "Delegation" }} kicker={chain.name} title="Delegation statistics" description="How much voting power is delegated, on which tracks, and to whom." />
      {!result.available ? <PendingBackend result={result} issue={103} what="Delegation statistics" /> : data ? (
        <>
          <StatStrip items={[
            { label: "Delegated votes", value: amount(data.total_delegated_votes) },
            { label: "Delegated capital", value: amount(data.total_delegated_capital) },
            { label: "Delegators", value: (data.delegators ?? 0).toLocaleString() },
            { label: "Delegates", value: (data.delegates ?? 0).toLocaleString() },
          ]} />
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel padding="content">
              <ModuleHeader title="By track" />
              <BarList items={(data.by_origin ?? []).map((row) => ({
                label: formatOriginName(row.origin) || row.origin,
                value: Number((big(row.votes) * BigInt(10000)) / maxVotes) / 100,
                detail: `${amount(row.votes)} · ${row.delegators ?? 0} delegators`,
                tone: "live" as const,
              }))} />
            </Panel>
            <Panel padding="content">
              <ModuleHeader title="Top delegates" />
              <ol className="divide-y divide-line">
                {(data.top_delegates ?? []).map((row, index) => {
                  const who = addressOf(row.account);
                  return (
                    <li key={who?.address ?? index} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
                      <span className="min-w-0"><span className="num mr-2 text-mute">{index + 1}</span>{who ? <AccountLink network={network} address={who.address} display={who.display} href={withChain(`/delegation/${encodeURIComponent(who.address)}/`, network)} /> : "—"}</span>
                      <span className="num text-mute">{amount(row.votes)} · {row.delegators ?? 0}</span>
                    </li>
                  );
                })}
              </ol>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
