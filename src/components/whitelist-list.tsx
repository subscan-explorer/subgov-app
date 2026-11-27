"use client";

import { PreimageDecode } from "@/components/preimage-actions";
import { ArrowLink, Panel } from "@/components/ui";
import { DataNotice } from "@/components/data-notice";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import { getChainApi } from "@/lib/chain-api";
import { useEffect, useState } from "react";

/** Call hashes the Fellowship has whitelisted (`whitelist.whitelistedCall`), with their decoded preimage. */
export function WhitelistList() {
  const chain = useChain();
  return <WhitelistForChain key={chain.genesisHash} />;
}

function WhitelistForChain() {
  const chain = useChain();
  const chainHref = useChainHref();
  const [state, setState] = useState<{ hashes: string[] | null; error: string | null }>({ hashes: null, error: null });
  useEffect(() => {
    let cancelled = false;
    getChainApi(chain.rpc, chain.genesisHash)
      .then(async (api) => {
        if (!api.query.whitelist?.whitelistedCall) throw new Error("This network has no whitelist pallet");
        const keys = await api.query.whitelist.whitelistedCall.keys();
        return keys.map((key) => key.args[0].toHex());
      })
      .then((hashes) => { if (!cancelled) setState({ hashes, error: null }); })
      .catch((cause) => { if (!cancelled) setState({ hashes: null, error: cause instanceof Error ? cause.message : "Could not read the whitelist" }); });
    return () => { cancelled = true; };
  }, [chain.rpc, chain.genesisHash]);
  if (state.error) return <DataNotice kind="error">{state.error}</DataNotice>;
  if (!state.hashes) return <p className="text-sm text-mute" role="status">Reading whitelisted calls from {chain.name}…</p>;
  if (!state.hashes.length) return <DataNotice kind="empty" title="Nothing whitelisted">No calls are whitelisted on {chain.name} right now.</DataNotice>;
  return (
    <Panel className="divide-y divide-line">
      {state.hashes.map((hash) => (
        <div key={hash} className="flex flex-col gap-2 px-5 py-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="num break-all text-paper">{hash}</span>
            <ArrowLink size="sm" href={chainHref("/referenda/", { track: 1 })}>Whitelisted Caller referenda</ArrowLink>
          </div>
          <PreimageDecode hash={hash} />
        </div>
      ))}
    </Panel>
  );
}
