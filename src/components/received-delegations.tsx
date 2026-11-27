"use client";

import { useAccountVoting } from "@/components/account-votes";
import { ModuleHeader, Panel } from "@/components/ui";
import { formatPlanck } from "@/components/undelegate";
import { useChainHref } from "@/hooks/use-chain-href";
import type { ChainConfig } from "@/lib/chains";
import { formatBaseUnits, shortAddr } from "@/lib/format";
import { receivedDelegations, type DelegatorRow } from "@/lib/gov-actions";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Delegations an address receives: per-track totals from `votingFor(…).casting.delegations` on-chain, and the
 * individual delegators indexed by Subscan.
 */
export function ReceivedDelegations(props: { chain: ChainConfig; address: string }) {
  return <ReceivedForAccount key={`${props.chain.genesisHash}:${props.address}`} {...props} />;
}

function ReceivedForAccount({ chain, address }: { chain: ChainConfig; address: string }) {
  const chainHref = useChainHref();
  const { snapshot, error } = useAccountVoting(chain, address);
  const [delegators, setDelegators] = useState<{ rows: DelegatorRow[]; error?: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDelegators(null);
    receivedDelegations(chain.id, address).then((value) => { if (!cancelled) setDelegators(value); }).catch(() => { if (!cancelled) setDelegators({ rows: [], error: "Delegators could not be loaded" }); });
    return () => { cancelled = true; };
  }, [chain.id, address]);
  const tracks = snapshot?.tracks.filter((track) => track.received.capital > BigInt(0)) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Panel padding="content">
        <ModuleHeader title="Received by track" meta="on-chain" />
        {error ? <p className="text-sm text-nay" role="alert">Could not read {chain.name}: {error}</p>
          : !snapshot ? <p className="text-sm text-mute" role="status">Reading delegations from {chain.name}…</p>
          : tracks.length === 0 ? <p className="text-sm text-mute">Nobody delegates to this address on any track.</p>
          : (
            <ul className="divide-y divide-line">
              {tracks.map((track) => (
                <li key={track.trackId} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
                  <span>{track.trackId} · {track.trackName}</span>
                  <span className="num text-mute">{formatPlanck(track.received.votes, chain)} votes · {formatPlanck(track.received.capital, chain)} capital</span>
                </li>
              ))}
            </ul>
          )}
      </Panel>
      <Panel padding="content">
        <ModuleHeader title="Delegators" meta={delegators?.rows.length ? `${delegators.rows.length} indexed` : undefined} />
        {!delegators ? <p className="text-sm text-mute" role="status">Loading delegators…</p>
          : delegators.error ? <p className="text-sm text-mute">{delegators.error}</p>
          : delegators.rows.length === 0 ? <p className="text-sm text-mute">No delegators indexed by Subscan.</p>
          : (
            <ul className="divide-y divide-line">
              {delegators.rows.map((row, index) => (
                <li key={`${row.address}-${row.trackId ?? index}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span className="min-w-0">
                    <Link className="text-link" href={chainHref(`/user/${encodeURIComponent(row.address)}/`)} title={row.address}>{row.display ?? shortAddr(row.address, 6)}</Link>
                    {row.origin || row.trackId != null ? <span className="ml-2 text-xs text-mute">{row.origin ?? `Track ${row.trackId}`}</span> : null}
                  </span>
                  <span className="num text-mute">{formatBaseUnits(row.amount, chain.decimals) ?? row.amount} {chain.symbol}{row.conviction ? ` · ${row.conviction}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
      </Panel>
    </div>
  );
}
