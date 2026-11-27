import type { Metadata } from "next";
import { DataNotice } from "@/components/data-notice";
import { DelegateDialog } from "@/components/delegate-dialog";
import { DelegateLookupForm } from "@/components/delegate-lookup-form";
import { CopyButton } from "@/components/copy-button";
import { ListPagination } from "@/components/list-pagination";
import { ArrowLink, PageHeader, Panel, SectionHeader } from "@/components/ui";
import { isLikelySs58Address } from "@/lib/address";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { formatDot, shortAddr } from "@/lib/format";
import { activeNetwork } from "@/lib/network-server";
import { SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import { liveTracks } from "@/lib/subscan-data";
import { governanceUpstream } from "@/lib/subscan-request";
import { liveDelegates } from "@/lib/subscan-governance";
import { peopleLive } from "@/lib/subscan-people";
import { tokenForNetwork } from "@/lib/tokens";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Delegation" };

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; chain?: string; page?: string }> }) {
  const params = await searchParams;
  const query = params.q?.trim();
  const network = await activeNetwork(params.chain);
  const chain = governanceChains[network].name;
  const requestedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage - 1 : 0;
  const token = tokenForNetwork(network);

  if (query && isLikelySs58Address(query)) {
    redirect(withChain(`/delegation/${encodeURIComponent(query)}/`, network));
  }

  const [directoryResult, tracksResult] = await Promise.allSettled([
    liveDelegates(network, page),
    liveTracks(governanceUpstream(network)),
  ]);
  const directory = directoryResult.status === "fulfilled" ? directoryResult.value : null;
  const tracks = tracksResult.status === "fulfilled" ? tracksResult.value : [];
  const totalPages = Math.max(1, Math.ceil((directory?.count ?? 0) / SUBSCAN_PAGE_SIZE));

  let results: Record<string, unknown>[] | null = null;
  if (query) {
    try {
      results = await peopleLive.searchIdentity(query, network);
    } catch {
      results = null;
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        kicker={`${chain} · OpenGov`}
        title="Delegation"
        description="Browse every indexed OpenGov delegate, inspect their account activity, and delegate voting power to a specific track."
      />
      <div className="-mt-2 flex flex-wrap gap-x-5 gap-y-2">
        <ArrowLink href={withChain("/delegation/mine/", network)}>My delegations</ArrowLink>
        <ArrowLink href={withChain("/delegation/statistics/", network)}>Delegation statistics</ArrowLink>
      </div>

      {query && results === null ? (
        <DataNotice kind="error">Unable to search identities right now. Try pasting the full SS58 address instead.</DataNotice>
      ) : null}
      {query && results?.length === 0 ? (
        <DataNotice kind="empty" title="No identity matches">
          No identities matched &ldquo;{query}&rdquo;. The complete delegate directory remains available below.
        </DataNotice>
      ) : null}
      {query && results && results.length > 0 ? (
        <section aria-labelledby="identity-results-title">
          <SectionHeader id="identity-results-title" title="Identity matches" />
          <Panel className="divide-y divide-line">
            {results.map((row, index) => {
              const identifier = row.identifier as Record<string, unknown> | undefined;
              const people = identifier?.people as Record<string, unknown> | undefined;
              const address = String(identifier?.address ?? row.address ?? "");
              const display = String(people?.display ?? row.display ?? address);
              if (!address) return null;
              return (
                <div key={`${address}-${index}`} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <Link href={withChain(`/delegation/${encodeURIComponent(address)}/`, network)} className="group min-w-0">
                    <div className="text-base text-paper">{display}</div>
                    <div className="num mt-1 break-all text-xs text-mute">{address}</div>
                  </Link>
                  <DelegateDialog target={address} label={display} tracks={tracks} />
                </div>
              );
            })}
          </Panel>
        </section>
      ) : null}

      <section aria-labelledby="delegate-directory-title">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="delegate-directory-title" className="section-title">Delegate directory</h2>
            <span className="text-sm text-mute">{directory ? `${directory.count.toLocaleString()} indexed` : "Asset Hub account index"}</span>
          </div>
          <DelegateLookupForm defaultQuery={query ?? ""} />
        </div>
        {/* Ten or more delegate cards make navigation at both ends useful; use the same controls and summary in each position. */}
        {directory && directory.rows.length >= 10 ? <div className="mb-3"><ListPagination path="/delegation/" network={network} page={page} totalPages={totalPages} extra={{ q: query }} top /></div> : null}
        {directory === null ? (
          <DataNotice kind="error">Unable to load delegates from the {chain} index. Retry in a moment.</DataNotice>
        ) : directory.rows.length === 0 ? (
          <DataNotice kind="empty">No delegates were returned for this page.</DataNotice>
        ) : (
          <Panel className="divide-y divide-line">
            {directory.rows.map((delegate) => (
              <article key={delegate.address} className="grid gap-4 px-4 py-4 sm:px-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] xl:items-center">
                <div className="min-w-0">
                  <Link href={withChain(`/delegation/${encodeURIComponent(delegate.address)}/`, network)} className="group block min-w-0">
                    <h3 className="record-title truncate">{delegate.display || "Unnamed delegate"}</h3>
                  </Link>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1">
                    <span className="num truncate text-xs leading-5 text-mute" title={delegate.address}>{shortAddr(delegate.address, 8)}</span>
                    <CopyButton value={delegate.address} />
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm xl:text-right">
                  {delegate.votingPower ? <div><dt className="text-xs text-mute">Voting power</dt><dd className="num mt-1 break-words text-paper">{formatDot(delegate.votingPower, token.symbol)}</dd></div> : null}
                  {delegate.tracks?.length ? <div><dt className="text-xs text-mute">Tracks</dt><dd className="mt-1 break-words text-paper">{delegate.tracks.join(", ")}</dd></div> : null}
                  <div>
                    <dt className="text-xs text-mute">Locked for voting</dt>
                    <dd className="num mt-1 break-words text-paper">{formatDot(delegate.locked, token.symbol)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-mute">Balance</dt>
                    <dd className="num mt-1 break-words text-paper">{formatDot(delegate.balance, token.symbol)}</dd>
                  </div>
                </dl>
                <DelegateDialog target={delegate.address} label={delegate.display} tracks={tracks} />
              </article>
            ))}
          </Panel>
        )}
      </section>
      <ListPagination path="/delegation/" network={network} page={page} totalPages={totalPages} extra={{ q: query }} />
    </div>
  );
}
