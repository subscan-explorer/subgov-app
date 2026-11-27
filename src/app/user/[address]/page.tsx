import type { Metadata } from "next";
import { DataNotice } from "@/components/data-notice";
import { ArrowLink, ModuleHeader, PageHeader, Panel } from "@/components/ui";
import { SubscanLink } from "@/components/subscan-link";
import { withChain } from "@/lib/chain-query";
import { activeChainLabel, activeNetwork } from "@/lib/network-server";
import { formatAmount, formatBalance, tokenForNetwork } from "@/lib/tokens";
import { CopyButton } from "@/components/copy-button";
import { shortAddr } from "@/lib/format";
import { chains } from "@/lib/chains";
import { peopleLive } from "@/lib/subscan-people";
import Link from "next/link";
import { UserTabBody, UserTabNav } from "@/components/user-tabs";
import { userTab } from "@/lib/user-tab";

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  const { address } = await params;
  return { title: `Account ${shortTitle(decodeURIComponent(address))}` };
}
function shortTitle(value: string) {
  return value.length > 16 ? `${value.slice(0, 6)}…${value.slice(-6)}` : value;
}


export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ chain?: string; tab?: string }>;
}) {
  const { address } = await params;
  const decoded = decodeURIComponent(address);
  const query = await searchParams;
  const network = await activeNetwork(query.chain);
  const tab = userTab(query.tab);
  const chain = await activeChainLabel();
  let tokens: Awaited<ReturnType<typeof peopleLive.accountTokens>> = [];
  let referenda: Awaited<ReturnType<typeof peopleLive.accountReferenda>>["rows"] = [];
  let referendaCount = 0;
  let history: Awaited<ReturnType<typeof peopleLive.balanceHistory>> = [];
  let profileIdentity: string | null = null;
  const results = await Promise.allSettled([
    peopleLive.accountTokens(decoded, network),
    peopleLive.accountReferenda(decoded, network),
    peopleLive.balanceHistory(decoded, network),
    peopleLive.accountIdentity(decoded, network),
  ]);
  if (results[0].status === "fulfilled") tokens = results[0].value;
  if (results[1].status === "fulfilled") {
    referenda = results[1].value.rows;
    referendaCount = results[1].value.count;
  }
  if (results[2].status === "fulfilled") history = results[2].value;
  if (results[3].status === "fulfilled") profileIdentity = results[3].value;
  const failed = results.some((result) => result.status === "rejected");
  const identity = profileIdentity ?? referenda.map(identityOf).find(Boolean) ?? null;
  const token = tokenForNetwork(network);
  const subscanUrl = (chains.find((item) => item.id === network) ?? chains[0]).subscanUrl;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={`${chain} · account`} title={identity ?? shortAddr(decoded, 8)} />
      <div className="-mt-3 flex min-w-0 items-center gap-1.5">
        <span className="num truncate text-sm text-mute" title={decoded}>{shortAddr(decoded, 10)}</span>
        <CopyButton value={decoded} />
      </div>
      <UserTabNav address={decoded} />
      {tab !== "overview" ? <UserTabBody address={decoded} /> : <>
      {failed ? <DataNotice kind="error">Some profile data is temporarily unavailable. Available sections are shown below.</DataNotice> : null}
          <div className="flex flex-wrap gap-3 text-sm">
            <ArrowLink href={withChain(`/delegation/${encodeURIComponent(decoded)}/`, network)}>Delegation profile</ArrowLink>
          </div>
          <Panel padding="content">
            <ModuleHeader title="Holdings" />
            {results[0].status === "rejected" ? <p className="mt-2 text-sm text-mute">Holdings could not be loaded.</p> : tokens.length === 0 ? <p className="mt-2 text-sm">No token balances indexed.</p> : (
              <ul className="mt-2 divide-y divide-line text-sm">
                {tokens.map((t, i) => (
                  <li key={String(t.unique_id ?? i)} className="flex flex-wrap justify-between gap-3 py-2">
                    <span>{(String(t.symbol ?? "").trim() || "Unknown token")}</span>
                    <span className="num">{formatAmount(String(t.balance ?? "0"), { symbol: (String(t.symbol ?? "").trim() || "Unknown token"), decimals: Number(t.decimals ?? 10) })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel padding="content">
            <ModuleHeader title="Governance activity" meta={referendaCount > referenda.length ? `${Math.min(15, referenda.length)} of ${referendaCount.toLocaleString()}` : referenda.length ? `${referenda.length} votes` : undefined} />
            {results[1].status === "rejected" ? <p className="mt-2 text-sm text-mute">Governance activity could not be loaded.</p> : referenda.length === 0 ? <p className="mt-2 text-sm">No referendum votes indexed.</p> : (
              <ul className="mt-2 divide-y divide-line text-sm">
                {referenda.slice(0, 15).map((r, i) => (
                  <li key={String(r.referendum_index ?? i)} className="py-2">
                    <Link href={withChain(`/referenda/${r.referendum_index}/`, network)} className="text-link">Referendum #{String(r.referendum_index)}</Link>
                    <span className="num ml-2 text-mute">{formatBalance(String(r.value ?? "0"), token)} · conviction {String(r.conviction ?? "—")}</span>
                  </li>
                ))}
              </ul>
            )}
            {referendaCount > Math.min(15, referenda.length) ? (
              <ArrowLink className="mt-3" href={`${subscanUrl}/account/${decoded}`} external>All {referendaCount.toLocaleString()} votes on Subscan</ArrowLink>
            ) : null}
          </Panel>
          {history.length > 0 ? (
            <Panel padding="content">
              <ModuleHeader title="Balance trend (last 30 days)" />
              <ul className="mt-2 text-sm">
                {history.slice(-8).map((h, i) => (
                  <li key={String(h.date ?? h.block ?? i)} className="flex justify-between py-1">
                    <span className="num">{h.date ? String(h.date) : h.block ? <SubscanLink kind="block" value={String(h.block)}>Block {String(h.block)}</SubscanLink> : "—"}</span>
                    <span className="num">{formatBalance(String(h.balance ?? ""), token)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
      </>}
    </div>
  );
}

function identityOf(row: Record<string, unknown>) {
  for (const key of ["account", "account_display"]) {
    const value = row[key] as { people?: { display?: string } } | undefined;
    if (value?.people?.display) return value.people.display;
  }
  return null;
}
