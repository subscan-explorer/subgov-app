"use client";

import { useEffect, useMemo, useState } from "react";
import { encodeAddress } from "@polkadot/util-crypto";
import { Addr } from "@/components/gov";
import { MetaItem, MetaList, ModuleHeader, Panel } from "@/components/ui";
import { useChain } from "@/hooks/use-chain-href";
import { getChainApi } from "@/lib/chain-api";
import type { DecodedProposal } from "@/lib/call-chain";
import { readAssetMeta } from "@/lib/treasury-chain";
import { assetKindMeta, isLocalPayout, locatableAsset, type AssetMeta } from "@/lib/asset-kind";
import { exactSpendAmount, proposalBeneficiary, proposalSpends } from "@/lib/proposal-spends";

export function ProposalRequests({ proposal, error, loaded }: { proposal?: DecodedProposal | null; error?: string | null; loaded: boolean }) {
  const chain = useChain();
  const requests = useMemo(() => proposal?.status === "decoded" ? proposalSpends(proposal.tree) : [], [proposal]);
  const scope = JSON.stringify([chain.id, requests]);
  const [metadata, setMetadata] = useState<{ scope: string; assets: AssetMeta[] } | null>(null);
  useEffect(() => {
    if (!requests.length) return;
    let cancelled = false;
    const lookups = new Map<string, Promise<AssetMeta>>();
    getChainApi(chain.rpc, chain.genesisHash).then((api) => Promise.all(requests.map((request) => {
      if (request.native) return { symbol: chain.symbol, decimals: chain.decimals, assetId: null };
      const key = JSON.stringify(request.assetKind) ?? "unknown";
      if (!lookups.has(key)) lookups.set(key, readAssetMeta(api, request.assetKind, chain));
      return lookups.get(key)!;
    }))).then((assets) => { if (!cancelled) setMetadata({ scope, assets }); }).catch(() => { /* Explicit base units remain available. */ });
    return () => { cancelled = true; };
  }, [chain, requests, scope]);
  if (proposal?.status === "decoded" && !requests.length) return null;
  if (loaded && !proposal && !error) return null;
  return <Panel padding="content">
    <ModuleHeader title="Requested payments" />
    {!requests.length ? <p className="text-sm text-mute" role="status">{error ? "Requested payments could not be read from the chain." : proposal?.status === "missing" ? `Requested payments unavailable: ${proposal.reason}.` : "Reading requested payments from the proposal…"}</p> : <>
      <p className="mb-4 text-xs leading-5 text-mute">Treasury calls in this proposal. These are requested payments; execution and delivery depend on the proposal outcome and call conditions.</p>
      <div className="divide-y divide-line">{requests.map((request, index) => {
        const asset = metadata?.scope === scope ? metadata.assets[index] : request.native ? chain : assetKindMeta(request.assetKind, chain);
        const beneficiary = proposalBeneficiary(request.beneficiary);
        let address = beneficiary;
        try { if (address && !/^0x[\da-f]{40}$/i.test(address)) address = encodeAddress(address, chain.id === "kusama" ? 2 : 0); } catch { address = null; }
        const local = request.native || isLocalPayout(locatableAsset(request.assetKind));
        return <div key={index} className="py-4 first:pt-0 last:pb-0">
          <MetaList>
            <MetaItem label="Amount" value={<span className="num break-all">{request.amount == null ? "Unavailable" : `${exactSpendAmount(request.amount, asset.decimals)} ${asset.symbol}`}</span>} />
            <MetaItem label="Beneficiary" value={address ? <Addr address={address} /> : "See beneficiary location in Call"} />
            <MetaItem label="Payout chain" value={local ? chain.name : "Remote or unrecognized location · see Call"} />
            <MetaItem label="Call" value={request.call} />
          </MetaList>
        </div>;
      })}</div>
    </>}
  </Panel>;
}
