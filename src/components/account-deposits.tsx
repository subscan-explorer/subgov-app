"use client";

import { DataNotice } from "@/components/data-notice";
import { TxDialog } from "@/components/tx-dialog";
import { Button, Field, Input, ModuleHeader, Panel } from "@/components/ui";
import { formatPlanck } from "@/components/undelegate";
import { useChainHref } from "@/hooks/use-chain-href";
import { buildDepositRefund, readRefundableDeposits } from "@/lib/account-chain";
import type { DepositKind } from "@/lib/account-voting";
import type { ChainConfig } from "@/lib/chains";
import { formatBaseUnits } from "@/lib/format";
import { accountDeposits, type DepositPage, type DepositRow } from "@/lib/gov-actions";
import Link from "next/link";
import { useEffect, useState } from "react";

type DepositId = { referendumId: number; kind: DepositKind };
type Refundable = DepositId & { amount: bigint; state: string };

const depositKey = (item: DepositId) => `${item.referendumId}-${item.kind}`;

function RefundButton({ chain, depositor, item, onDone }: { chain: ChainConfig; depositor: string; item: DepositId & { amountLabel: string }; onDone: () => void }) {
  return (
    <TxDialog
      chain={chain}
      title={`Refund ${item.kind} deposit · #${item.referendumId}`}
      triggerLabel="Refund"
      size="sm"
      successText={`The ${item.kind} deposit of ${item.amountLabel} is returned to the depositor.`}
      submitLabel="Sign & refund"
      onDone={onDone}
      build={(api) => buildDepositRefund(api, item.referendumId, item.kind, depositor)}
    >
      <p className="text-sm leading-6">
        Calls <span className="num">referenda.{item.kind === "submission" ? "refundSubmissionDeposit" : "refundDecisionDeposit"}({item.referendumId})</span>. Anyone may submit it; the {item.amountLabel} always goes back to the account that placed the deposit.
      </p>
    </TxDialog>
  );
}

/**
 * Referendum deposits of an address. The list comes from Subscan's deposit index (subgov#90); until that endpoint is
 * deployed the page checks referenda by number directly on-chain.
 */
export function AccountDeposits({ chain, address, canSign }: { chain: ChainConfig; address: string; canSign: boolean }) {
  const chainHref = useChainHref();
  const [page, setPage] = useState(0);
  const [loaded, setLoaded] = useState<{ page: number; data: DepositPage } | null>(null);
  const [listError, setListError] = useState<{ page: number; message: string } | null>(null);
  const [refunded, setRefunded] = useState<Set<string>>(() => new Set());
  const indexed = loaded?.page === page ? loaded.data : null;
  const totalPages = indexed?.available ? Math.max(1, Math.ceil(indexed.count / indexed.pageSize)) : 0;
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Refundable[] | null>(null);
  const visibleChecked = checked?.filter((item) => !refunded.has(depositKey(item)));
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    accountDeposits(chain.id, address, page).then((data) => {
      if (cancelled) return;
      const lastPage = Math.max(0, Math.ceil(data.count / data.pageSize) - 1);
      if (data.available && page > lastPage) {
        setPage(lastPage);
        return;
      }
      setLoaded({ page, data });
    }).catch((cause) => {
      if (cancelled) return;
      setListError({ page, message: cause instanceof Error ? cause.message : "Deposits could not be loaded" });
    });
    return () => { cancelled = true; };
  }, [chain.id, address, page]);

  const selectPage = (next: number) => {
    setLoaded(null);
    setListError(null);
    setPage(next);
  };

  const markRefunded = (item: DepositId) => {
    const key = depositKey(item);
    setRefunded((current) => new Set(current).add(key));
  };

  const check = async () => {
    const ids = query.split(/[\s,#]+/).map((part) => Number(part)).filter((id) => Number.isSafeInteger(id) && id >= 0).slice(0, 50);
    if (!ids.length) {
      setCheckError("Enter one or more referendum numbers");
      return;
    }
    setChecking(true);
    setCheckError(null);
    try {
      setChecked(await readRefundableDeposits({ rpc: chain.rpc, genesisHash: chain.genesisHash, address, referendumIds: ids }));
    } catch (cause) {
      setCheckError(cause instanceof Error ? cause.message : "Could not read referenda");
    } finally {
      setChecking(false);
    }
  };

  const amountOf = (row: DepositRow) => `${formatBaseUnits(row.amount, row.decimals ?? chain.decimals) ?? row.amount} ${row.symbol ?? chain.symbol}`;

  return (
    <div className="flex flex-col gap-6">
      <Panel padding="content">
        <ModuleHeader title="Referendum deposits" meta={indexed?.available ? `${indexed.count.toLocaleString()} on record` : undefined} />
        {listError?.page === page ? (
          <p className="text-sm text-nay" role="alert">{listError.message}</p>
        ) : indexed == null ? (
          <p className="text-sm text-mute" role="status">Loading deposits…</p>
        ) : !indexed.available ? (
          <DataNotice kind="info" title="Deposit index not available yet">
            The Subscan deposit index for {chain.name} is not deployed yet. Check specific referenda below; refundable deposits are read directly from the chain.
          </DataNotice>
        ) : indexed.rows.length === 0 ? (
          <p className="text-sm text-mute">No submission or decision deposits from this address.</p>
        ) : (
          <ul className="divide-y divide-line">
            {indexed.rows.map((row) => {
              const key = depositKey(row);
              const isRefunded = row.refunded || refunded.has(key);
              return (
                <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <Link className="text-link" href={chainHref(`/referenda/${row.referendumId}/`)}>#{row.referendumId}</Link>
                    <span className="ml-2 text-mute">{row.kind === "submission" ? "Submission" : "Decision"} deposit · {row.status ?? "—"}{row.origin ? ` · ${row.origin}` : ""}</span>
                    <div className="num mt-1 text-xs text-mute">{amountOf(row)}{isRefunded ? " · refunded" : ""}</div>
                  </div>
                  {canSign && row.refundable && !isRefunded ? (
                    <RefundButton chain={chain} depositor={address} item={{ ...row, amountLabel: amountOf(row) }} onDone={() => markRefunded(row)} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {page > 0 || totalPages > 1 ? (
          <nav aria-label="Deposit pages" className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button type="button" variant="line" disabled={page === 0} onClick={() => selectPage(page - 1)}>Previous</Button>
            <span className="text-xs text-mute">Page {page + 1}{totalPages > 0 ? ` of ${totalPages}` : ""}</span>
            <Button type="button" variant="line" disabled={page + 1 >= totalPages} onClick={() => selectPage(page + 1)}>Next</Button>
          </nav>
        ) : null}
      </Panel>
      <Panel padding="content">
        <ModuleHeader title="Check referenda on-chain" />
        <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void check(); }}>
          <div className="min-w-0 flex-1">
            <Field label="Referendum numbers">
              <Input inputMode="numeric" placeholder="e.g. 1520, 1533" value={query} onChange={(event) => setQuery(event.target.value)} />
            </Field>
          </div>
          <Button type="submit" variant="line" disabled={checking}>{checking ? "Reading…" : "Check"}</Button>
        </form>
        {checkError ? <p className="mt-3 text-sm text-nay" role="alert">{checkError}</p> : null}
        {visibleChecked ? (
          visibleChecked.length === 0 ? <p className="mt-3 text-sm text-mute">No refundable deposits from this address on those referenda.</p> : (
            <ul className="mt-3 divide-y divide-line">
              {visibleChecked.map((item) => (
                <li key={`${item.referendumId}-${item.kind}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span><Link className="text-link" href={chainHref(`/referenda/${item.referendumId}/`)}>#{item.referendumId}</Link> <span className="text-mute">{item.kind} deposit · {item.state} · <span className="num">{formatPlanck(item.amount, chain)}</span></span></span>
                  {canSign ? <RefundButton chain={chain} depositor={address} item={{ ...item, amountLabel: formatPlanck(item.amount, chain) }} onDone={() => markRefunded(item)} /> : null}
                </li>
              ))}
            </ul>
          )
        ) : null}
      </Panel>
    </div>
  );
}
