"use client";

import { useApp } from "@/components/app-state";
import { Button, Input, TextButton } from "@/components/ui";
import { sameAccount } from "@/lib/account-chain";
import { getChainApi } from "@/lib/chain-api";
import type { ChainConfig } from "@/lib/chains";
import { formatBaseUnits, shortAddr } from "@/lib/format";
import { accountIdentities } from "@/lib/gov-actions";
import { proxyAllowsGovernance } from "@/lib/wallets";
import { decodeAddress } from "@polkadot/util-crypto";
import { useEffect, useState } from "react";

const validAddress = (value: string) => {
  try {
    return decodeAddress(value.trim()).length === 32;
  } catch {
    return false;
  }
};

/** Transferable balance and identity for the accounts in the switcher (#114). */
export function useAccountSummaries(chain: ChainConfig, addresses: string[]) {
  const [balances, setBalances] = useState<Record<string, string>>({});
  const [identities, setIdentities] = useState<Record<string, string>>({});
  const key = addresses.join(",");
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    const list = key.split(",");
    getChainApi(chain.rpc, chain.genesisHash).then(async (api) => {
      const rows = await api.query.system.account.multi(list);
      if (cancelled) return;
      setBalances(Object.fromEntries(rows.map((row, index) => {
        const data = (row as unknown as { data: { free: { toBigInt(): bigint }; frozen?: { toBigInt(): bigint } } }).data;
        const free = data.free.toBigInt();
        const frozen = data.frozen?.toBigInt() ?? BigInt(0);
        return [list[index], (free > frozen ? free - frozen : BigInt(0)).toString()];
      })));
    }).catch(() => undefined);
    accountIdentities(chain.id, list).then((next) => { if (!cancelled) setIdentities(next); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [chain.genesisHash, chain.id, chain.rpc, key]);
  const balance = (address: string) => balances[address] ? `${formatBaseUnits(balances[address], chain.decimals) ?? "0"} ${chain.symbol}` : null;
  return { balance, identity: (address: string) => identities[address] ?? null };
}

/** Browse as any address without a wallet (#115). Actions that need a signature stay disabled. */
export function WatchAddressForm({ onDone }: { onDone?: () => void }) {
  const { connectWatch } = useApp();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="flex flex-col gap-2" onSubmit={(event) => {
      event.preventDefault();
      if (!validAddress(value)) { setError("Enter a valid Substrate address."); return; }
      try {
        connectWatch(value);
        onDone?.();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not watch this address");
      }
    }}>
      <label className="text-xs font-medium text-mute" htmlFor="watch-address">Watch an address (read-only)</label>
      <div className="flex gap-2">
        <Input id="watch-address" className="min-w-0 flex-1" placeholder="SS58 address" autoComplete="off" spellCheck={false} value={value} onChange={(event) => { setValue(event.target.value); setError(null); }} />
        <Button type="submit" variant="line" disabled={!value.trim()}>Watch</Button>
      </div>
      {error ? <p className="text-xs text-nay" role="alert">{error}</p> : <p className="text-xs text-mute">See votes, locks and deposits for any account. Nothing can be signed.</p>}
    </form>
  );
}

type ProxyCheck = { state: "idle" | "checking" | "ok" | "error"; message?: string };

/** Sign governance calls for another account that made this wallet account its proxy (#116). */
export function ProxyPanel({ chain }: { chain: ChainConfig }) {
  const { signerAccount, proxyReal, setProxyReal, readOnly } = useApp();
  const [value, setValue] = useState("");
  const [check, setCheck] = useState<ProxyCheck>({ state: "idle" });
  if (!signerAccount || readOnly) return null;
  const verify = async () => {
    const real = value.trim();
    if (!validAddress(real)) { setCheck({ state: "error", message: "Enter a valid Substrate address." }); return; }
    if (sameAccount(real, signerAccount)) { setCheck({ state: "error", message: "That is the wallet account itself." }); return; }
    setCheck({ state: "checking" });
    try {
      const api = await getChainApi(chain.rpc, chain.genesisHash);
      if (!api.query.proxy?.proxies) throw new Error("This network has no proxy pallet.");
      const [definitions] = (await api.query.proxy.proxies(real)).toJSON() as [{ delegate: string; proxyType: string; delay: number }[], unknown];
      const mine = (definitions ?? []).filter((item) => sameAccount(item.delegate, signerAccount));
      if (!mine.length) throw new Error(`${shortAddr(signerAccount)} is not a proxy of this account.`);
      const usable = mine.find((item) => proxyAllowsGovernance(item.proxyType) && !item.delay);
      if (!usable) throw new Error(`Proxy type ${mine.map((item) => `${item.proxyType}${item.delay ? ` (delay ${item.delay})` : ""}`).join(", ")} cannot sign governance calls directly. Any, NonTransfer or Governance without delay is needed.`);
      setProxyReal(real);
      setCheck({ state: "ok", message: `${usable.proxyType} proxy` });
      setValue("");
    } catch (cause) {
      setCheck({ state: "error", message: cause instanceof Error ? cause.message : "Could not read proxies" });
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-mute">Proxy</p>
      {proxyReal ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-line px-3 py-2 text-sm">
          <span>Acting for <span className="num" title={proxyReal}>{shortAddr(proxyReal, 6)}</span>{check.state === "ok" && check.message ? <span className="text-xs text-mute"> · {check.message}</span> : null}</span>
          <TextButton tone="danger" onClick={() => { setProxyReal(null); setCheck({ state: "idle" }); }}>Stop</TextButton>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input aria-label="Account to act for" className="min-w-0 flex-1" placeholder="Real account address" autoComplete="off" spellCheck={false} value={value} onChange={(event) => { setValue(event.target.value); setCheck({ state: "idle" }); }} />
          <Button type="button" variant="line" disabled={!value.trim() || check.state === "checking"} onClick={verify}>{check.state === "checking" ? "Checking…" : "Use"}</Button>
        </div>
      )}
      {check.state === "error" ? <p className="text-xs text-nay" role="alert">{check.message}</p>
        : <p className="text-xs text-mute">{proxyReal ? `Votes, delegations and other governance calls are wrapped in proxy.proxy and signed by ${shortAddr(signerAccount)}.` : "Vote or delegate for an account that added this wallet account as a proxy."}</p>}
    </div>
  );
}

/** Shown in signing dialogs while acting as a proxy (#116). */
export function ProxyNote() {
  const { proxySigner, account } = useApp();
  if (!proxySigner || !account) return null;
  return <p className="rounded-2xl bg-panel-2 p-3 text-xs leading-5 text-mute">Signed by <span className="num text-paper">{shortAddr(proxySigner)}</span> as a proxy for <span className="num text-paper">{shortAddr(account)}</span>. The call is wrapped in proxy.proxy and the fee is paid by the proxy.</p>;
}
