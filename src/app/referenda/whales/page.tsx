import type { Metadata } from "next";
import Link from "next/link";
import { AccountLink } from "@/components/account-link";
import { DataNotice } from "@/components/data-notice";
import { PendingBackend } from "@/components/pending-backend";
import { ChoiceGroup, PageHeader, Panel } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { formatBaseUnits } from "@/lib/format";
import { activeNetwork } from "@/lib/network-server";
import { addressOf, listOf, optionalGovernance } from "@/lib/subscan-optional";

export const metadata: Metadata = { title: "Whale votes" };

type Whale = { account?: unknown; votes?: string; capital?: string; referenda_count?: number; latest?: { referendum_index: number; status?: string; votes?: string }[] };

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string; status?: string }> }) {
  const query = await searchParams;
  const network = await activeNetwork(query.chain);
  const chain = governanceChains[network];
  const status = query.status === "history" ? "history" : "active";
  // Endpoint requested in subgov#96.
  const result = await optionalGovernance<{ list?: Whale[]; decimals?: number; symbol?: string }>(network, "scan/referenda/whales", { status, page: 0, row: 50 });
  const decimals = result.available ? result.data.decimals ?? chain.decimals : chain.decimals;
  const symbol = result.available ? result.data.symbol ?? chain.symbol : chain.symbol;
  const amount = (value?: string) => (value ? `${formatBaseUnits(value, decimals) ?? value} ${symbol}` : "—");
  const rows = result.available ? listOf<Whale>(result.data) : [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: withChain("/referenda/", network), label: "Referenda" }} kicker={chain.name} title="Whale votes"
        description={status === "active" ? "Accounts with the most voting power on referenda that are still open." : "Accounts with the most voting power across past referenda."} />
      <ChoiceGroup aria-label="Whale scope">
        {(["active", "history"] as const).map((value) => (
          <Link key={value} href={withChain("/referenda/whales/", network, { status: value === "active" ? undefined : value })} aria-current={value === status ? "page" : undefined}
            className={value === status ? "rounded-full bg-paper px-4 py-2 text-sm text-ink" : "rounded-full bg-panel px-4 py-2 text-sm text-mute hover:text-paper"}>
            {value === "active" ? "Open referenda" : "History"}
          </Link>
        ))}
      </ChoiceGroup>
      {!result.available ? <PendingBackend result={result} issue={96} what="Whale voting data" /> : rows.length === 0 ? <DataNotice kind="empty">No whale votes on record.</DataNotice> : (
        <Panel className="divide-y divide-line">
          {rows.map((row, index) => {
            const who = addressOf(row.account);
            return (
              <div key={who?.address ?? index} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-sm">
                <div className="min-w-0">
                  <span className="num mr-2 text-mute">{index + 1}</span>
                  {who ? <AccountLink network={network} address={who.address} display={who.display} /> : "—"}
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-mute">
                    {(row.latest ?? []).slice(0, 5).map((vote) => (
                      <Link key={vote.referendum_index} className="text-link" href={withChain(`/referenda/${vote.referendum_index}/`, network)}>#{vote.referendum_index} {vote.status ?? ""}</Link>
                    ))}
                  </div>
                </div>
                <div className="num text-right">
                  <div className="text-paper">{amount(row.votes)}</div>
                  <div className="text-xs text-mute">capital {amount(row.capital)}{row.referenda_count != null ? ` · ${row.referenda_count} referenda` : ""}</div>
                </div>
              </div>
            );
          })}
        </Panel>
      )}
    </div>
  );
}
