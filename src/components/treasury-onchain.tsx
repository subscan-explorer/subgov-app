"use client";

import { TxDialog } from "@/components/tx-dialog";
import { ModuleHeader, Panel, StatusBadge } from "@/components/ui";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import { cleanDescription, spendAction, spendStatusLabel } from "@/lib/asset-kind";
import { formatBaseUnits } from "@/lib/format";
import { buildSpendAction, readMultiAssetBounties, readMultiAssetChildren, readSpend, readTreasuryOverview, type MultiAssetBounty, type MultiAssetChild, type OnChainSpend, type TreasuryOverview } from "@/lib/treasury-chain";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

function useChainRead<T>(read: () => Promise<T>, deps: unknown[]) {
  const scope = JSON.stringify(deps);
  const [state, setState] = useState<{ scope: string; data: T | null; error: string | null; loading: boolean }>({ scope, data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    let cancelled = false;
    setState({ scope, data: null, error: null, loading: true });
    read().then((data) => { if (!cancelled) setState({ scope, data, error: null, loading: false }); })
      .catch((cause) => { if (!cancelled) setState({ scope, data: null, error: cause instanceof Error ? cause.message : "Could not read the chain", loading: false }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  return state.scope === scope ? { ...state, reload } : { data: null, error: null, loading: true, reload };
}

const days = (blocks: number) => {
  const hours = (blocks * 6) / 3600;
  return hours >= 48 ? `${Math.round(hours / 24)} days` : `${Math.max(1, Math.round(hours))} h`;
};

/** Treasury balances, spend-period countdown and burn, read from the chain (#104). */
export function TreasuryOnChain() {
  const chain = useChain();
  const { data, error } = useChainRead<TreasuryOverview>(() => readTreasuryOverview(chain), [chain.rpc, chain.genesisHash]);
  return (
    <Panel padding="content">
      <ModuleHeader title="Treasury account" meta={data ? <a className="text-link" href={`${chain.subscanUrl}/account/${data.account}`} target="_blank" rel="noreferrer">Subscan ↗</a> : undefined} />
      {error ? <p className="text-sm text-mute">Could not read the treasury from {chain.name}: {error}</p> : !data ? <p className="text-sm text-mute" role="status">Reading the treasury from {chain.name}…</p> : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {data.balances.map((balance) => (
            <div key={balance.symbol}>
              <div className="text-xs text-mute">{balance.symbol} balance</div>
              <div className="num mt-1 text-xl">{formatBaseUnits(balance.free.toString(), balance.decimals) ?? "0"}</div>
            </div>
          ))}
          <div>
            <div className="text-xs text-mute">Next spend period</div>
            {data.next ? (
              <>
                <div className="num mt-1 text-xl">in ~{days(data.next.remaining)}</div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-panel-2" aria-hidden="true"><div className="h-full bg-paper" style={{ width: `${Math.round(data.next.share * 100)}%` }} /></div>
                <div className="mt-1 text-xs text-mute">every {days(data.spendPeriod)} · block #{data.next.at.toLocaleString()}</div>
              </>
            ) : <div className="mt-1 text-sm text-mute">Schedule unavailable from the current chain data.</div>}
          </div>
          <div>
            <div className="text-xs text-mute">Burn per period</div>
            <div className="num mt-1 text-xl">{(data.burnPermill / 10_000).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</div>
            <div className="mt-1 text-xs text-mute">{data.burnPermill ? "of the native balance left after spending" : "No burn on this network"}</div>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function useSpend(index: number) {
  const chain = useChain();
  return useChainRead<{ spend: OnChainSpend; now: number }>(() => readSpend(chain, index), [chain.rpc, chain.genesisHash, index]);
}

const SpendContext = createContext<ReturnType<typeof useSpend> | null>(null);

export function SpendStateProvider({ index, children }: { index: number; children: ReactNode }) {
  const state = useSpend(index);
  return <SpendContext.Provider value={state}>{children}</SpendContext.Provider>;
}

export function SpendDetailStatus({ status }: { status: string }) {
  const state = useContext(SpendContext);
  return <StatusBadge status={spendStatusLabel(state?.data?.spend, status)} />;
}

/** Only indexed payment attempts need a live delivery check in the list. */
export function SpendPaymentStatus({ index, status }: { index: number; status: string }) {
  return status.toLowerCase() === "awarded" ? <LiveSpendPaymentStatus index={index} status={status} /> : <StatusBadge status={status} />;
}

function LiveSpendPaymentStatus({ index, status }: { index: number; status: string }) {
  const { data } = useSpend(index);
  return <StatusBadge status={spendStatusLabel(data?.spend, status)} />;
}

/** Payout / checkStatus share the detail header's snapshot and refresh after settlement. */
export function SpendActions({ index }: { index: number }) {
  const chain = useChain();
  const state = useContext(SpendContext);
  if (!state) throw new Error("SpendActions requires SpendStateProvider");
  const { data, error, reload } = state;
  if (error) return <p className="text-xs text-mute">Could not read spend #{index} on-chain: {error}</p>;
  if (!data) return <p className="text-xs text-mute" role="status">Reading spend status…</p>;
  const { action, note } = spendAction(data.spend, data.now);
  const amount = data.spend?.amount ? `${formatBaseUnits(data.spend.amount, data.spend.asset.decimals) ?? data.spend.amount} ${data.spend.asset.symbol}` : "";
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-xs leading-5 text-mute">{note}</p>
      {data.spend?.validFrom != null || data.spend?.expireAt != null ? <p className="num text-xs text-mute">valid from #{data.spend?.validFrom?.toLocaleString() ?? "—"} · expires #{data.spend?.expireAt?.toLocaleString() ?? "—"} · now #{data.now.toLocaleString()}</p> : null}
      {action ? (
        <TxDialog chain={chain} title={action === "payout" ? `Pay out spend #${index}` : `Check status of spend #${index}`} triggerLabel={action === "payout" ? "Claim payout" : "Check status"}
          submitLabel={action === "payout" ? "Sign & pay out" : "Sign & check status"} onDone={reload}
          successText={action === "payout" ? `The payment of ${amount} is initiated to the beneficiary.` : "The spend status is updated on-chain."}
          build={(api) => buildSpendAction(api, index, action)}>
          <p className="text-sm leading-6">{action === "payout" ? `Calls treasury.payout(${index}) and sends ${amount} to the beneficiary. Anyone may submit it.` : `Calls treasury.checkStatus(${index}). Settles an attempted payment or removes an expired spend.`}</p>
        </TxDialog>
      ) : null}
    </div>
  );
}

const amountOf = (value: string, asset: { decimals: number; symbol: string }) => `${formatBaseUnits(value, asset.decimals) ?? value} ${asset.symbol}`;

/** Multi-asset bounties read from `multiAssetBounties` (#107). */
export function MultiAssetBountyList() {
  const chain = useChain();
  const chainHref = useChainHref();
  const { data, error, loading } = useChainRead<MultiAssetBounty[] | null>(() => readMultiAssetBounties(chain), [chain.rpc, chain.genesisHash]);
  if (error) return <p className="text-sm text-nay" role="alert">{error}</p>;
  if (loading) return <p className="text-sm text-mute" role="status">Reading multi-asset bounties…</p>;
  if (data === null) return <p className="text-sm text-mute">Multi-asset bounties are not supported on {chain.name}.</p>;
  if (!data.length) return <p className="text-sm text-mute">No multi-asset bounties on {chain.name}.</p>;
  return (
    <Panel className="divide-y divide-line">
      {data.map((bounty) => (
        <Link key={bounty.id} href={chainHref(`/treasury/multiasset-bounties/${bounty.id}/`)} className="record-row">
          <span className="record-row-id num">#{bounty.id}</span>
          <span className="record-row-body">
            <span className="flex flex-wrap items-center gap-2"><StatusBadge status={bounty.status} /></span>
            <span className="record-title">{cleanDescription(bounty.description) ?? `Multi-asset bounty #${bounty.id}`}</span>
          </span>
          <span className="record-row-value"><span className="num block text-paper">{amountOf(bounty.value, bounty.asset)}</span></span>
        </Link>
      ))}
    </Panel>
  );
}

export function MultiAssetBountyDetail({ id }: { id: number }) {
  const chain = useChain();
  const bounties = useChainRead<MultiAssetBounty[] | null>(() => readMultiAssetBounties(chain), [chain.rpc, chain.genesisHash]);
  const children = useChainRead<MultiAssetChild[]>(() => readMultiAssetChildren(chain, id), [chain.rpc, chain.genesisHash, id]);
  const bounty = bounties.data?.find((item) => item.id === id);
  if (bounties.error) return <p className="text-sm text-nay" role="alert">{bounties.error}</p>;
  if (bounties.loading) return <p className="text-sm text-mute" role="status">Reading bounty #{id}…</p>;
  if (bounties.data === null) return <p className="text-sm text-mute">Multi-asset bounties are not supported on {chain.name}.</p>;
  if (!bounty) return <p className="text-sm text-mute">Multi-asset bounty #{id} is not stored on-chain (closed or never created).</p>;
  return (
    <div className="flex flex-col gap-6">
      <Panel padding="content">
        <ModuleHeader title={cleanDescription(bounty.description) ?? `Multi-asset bounty #${id}`} meta={<StatusBadge status={bounty.status} />} />
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-mute">Value</dt><dd className="num mt-1">{amountOf(bounty.value, bounty.asset)}</dd></div>
          <div><dt className="text-xs text-mute">Asset</dt><dd className="mt-1">{bounty.asset.symbol}{bounty.asset.assetId != null ? ` (id ${bounty.asset.assetId})` : ""}</dd></div>
          <div><dt className="text-xs text-mute">Curator</dt><dd className="num mt-1 break-all">{bounty.curator ?? "—"}</dd></div>
        </dl>
      </Panel>
      <Panel padding="content">
        <ModuleHeader title="Child bounties" meta={children.data ? `${children.data.length}` : undefined} />
        {children.error ? <p className="text-sm text-nay">{children.error}</p> : !children.data ? <p className="text-sm text-mute" role="status">Reading child bounties…</p> : children.data.length === 0 ? <p className="text-sm text-mute">No child bounties.</p> : (
          <ul className="divide-y divide-line">
            {children.data.map((child) => (
              <li key={child.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0"><span className="num mr-2 text-mute">#{child.id}</span>{cleanDescription(child.description) ?? "Child bounty"} <StatusBadge status={child.status} /></span>
                <span className="num text-mute">{amountOf(child.value, bounty.asset)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
