import type { Metadata } from "next";
import { DelegateDialog } from "@/components/delegate-dialog";
import { DataNotice } from "@/components/data-notice";
import { ArrowLink, PageHeader, Panel, SectionHeader, StatStrip } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { shortAddr } from "@/lib/format";
import Link from "next/link";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { activeNetwork } from "@/lib/network-server";
import { liveTracks } from "@/lib/subscan-data";
import { formatBalance, tokenForNetwork } from "@/lib/tokens";
import { governanceUpstream } from "@/lib/subscan-request";
import { liveDelegate, liveDelegateSupporters } from "@/lib/subscan-governance";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ address: string }> }): Promise<Metadata> {
  const { address } = await params;
  return { title: `Delegate ${shortTitle(decodeURIComponent(address))}` };
}
function shortTitle(value: string) {
  return value.length > 16 ? `${value.slice(0, 6)}…${value.slice(-6)}` : value;
}


export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ chain?: string }>;
}) {
  const { address } = await params;
  const { chain: chainParam } = await searchParams;
  const network = await activeNetwork(chainParam);
  const chainLabel = governanceChains[network].name;
  const decoded = decodeURIComponent(address);
  let profile: Awaited<ReturnType<typeof liveDelegate>> | undefined;
  let supporters: Awaited<ReturnType<typeof liveDelegateSupporters>> = [];
  const tracks = await liveTracks(governanceUpstream(network)).catch(() => []);
  try {
    [profile, supporters] = await Promise.all([liveDelegate(decoded, network), liveDelegateSupporters(decoded, network)]);
  } catch { profile = undefined; }
  if (!profile || Object.keys(profile).length === 0) notFound();
  const active = Array.isArray(profile.active_delegations)
    ? profile.active_delegations.length
    : Number(profile.active_delegated_count ?? profile.active_delegations ?? 0);
  const display =
    profile.account && typeof profile.account === "object"
      ? String((profile.account as { people?: { display?: string } }).people?.display ?? decoded)
      : decoded;

  const supporterTotal = supporters.reduce((sum, s) => {
    const n = Number(s.amount ?? s.votes ?? 0);
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
  const token = tokenForNetwork(network);
  const profileTracks = Array.isArray(profile.tracks) ? profile.tracks : [];
  const conviction = profile.conviction ?? profile.delegation_conviction;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: withChain("/delegation/", network), label: "Delegate directory" }}
        kicker={`${chainLabel} · OpenGov delegate`}
        title={display !== decoded ? display : shortAddr(decoded, 8)}
        actions={<DelegateDialog target={decoded} label={display !== decoded ? display : undefined} tracks={tracks} />}
      />
      <div className="-mt-3 flex min-w-0 flex-wrap items-center gap-3">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
          <span className="num truncate text-sm text-mute" title={decoded}>{shortAddr(decoded, 10)}</span>
          <CopyButton value={decoded} />
        </span>
        <ArrowLink href={withChain(`/user/${encodeURIComponent(decoded)}/`, network)} size="sm">Votes and holdings</ArrowLink>
      </div>
      {active || supporters.length ? (
        <StatStrip
          items={[
            { label: "Active delegations", value: (active || supporters.length).toLocaleString() },
            { label: "Delegated to them", value: supporterTotal > 0 ? formatBalance(String(supporterTotal), token) : "—" },
          ]}
        />
      ) : null}
      {profileTracks.length || conviction != null || profile.recent_votes ? (
        <Panel padding="compact">
          <SectionHeader title="Delegation details" />
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            {profileTracks.length ? <div><dt className="text-xs text-mute">Tracks</dt><dd>{profileTracks.map((track) => typeof track === "object" && track !== null ? String((track as { name?: string; id?: string | number }).name ?? (track as { id?: string | number }).id ?? "—") : String(track)).join(", ")}</dd></div> : null}
            {conviction != null ? <div><dt className="text-xs text-mute">Conviction</dt><dd>{String(conviction)}</dd></div> : null}
            {profile.recent_votes ? <div><dt className="text-xs text-mute">Recent votes</dt><dd>{String(profile.recent_votes)}</dd></div> : null}
          </dl>
        </Panel>
      ) : null}
      <section>
        <SectionHeader title="Supporters" meta={supporters.length ? `${supporters.length.toLocaleString()} indexed` : undefined} />
        {supporters.length === 0 ? (
          <DataNotice kind="empty" title="No active delegations">Nobody is delegating to this account on the indexed tracks yet.</DataNotice>
        ) : (
          <Panel className="divide-y divide-line">
            {supporters.map((s, i) => {
              const who = String((s.account as { address?: string })?.address ?? "");
              const name = (s.account as { people?: { display?: string } })?.people?.display;
              return (
                <div key={who || i} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <span className="flex min-w-0 items-center gap-1">
                    {who ? <Link className="min-w-0 truncate text-sm text-link" href={withChain(`/user/${encodeURIComponent(who)}/`, network)} title={who}>{name ?? shortAddr(who, 8)}</Link> : <span className="text-sm">—</span>}
                    {who ? <CopyButton value={who} /> : null}
                  </span>
                  <span className="num text-sm text-paper">{formatBalance(String(s.amount ?? s.votes ?? ""), token)}</span>
                </div>
              );
            })}
          </Panel>
        )}
      </section>
    </div>
  );
}
