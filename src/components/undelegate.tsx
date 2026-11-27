"use client";

import { useSubmissionLock, useWalletScope } from "@/hooks/use-submission-lock";

import { ProxyNote } from "@/components/wallet-extras";
import { Modal } from "@/components/modal";
import { useApp } from "@/components/app-state";
import { ArrowLink, Badge, Button, ButtonLink, Checkbox, ModuleHeader, Panel, TextButton } from "@/components/ui";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import type { ChainConfig } from "@/lib/chains";
import { planckToToken, shortAddr } from "@/lib/format";
import { convictionFromName, readAccountDelegations, submitUndelegation, type AccountDelegation, type VoteProgress } from "@/lib/vote";
import { notifyGovernanceChanged } from "@/lib/governance-sync";
import { governanceInclusionPhase } from "@/lib/referendum-tally";
import { walletCanSignOnChain } from "@/lib/wallet-chain";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export function formatPlanck(value: bigint, chain: Pick<ChainConfig, "decimals" | "symbol">) {
  return `${planckToToken(value.toString(), chain.decimals) ?? "0"} ${chain.symbol}`;
}

/** Confirms and signs `convictionVoting.undelegate` for one track, or `utility.batchAll` for several. */
export function UndelegateDialog(props: React.ComponentProps<typeof UndelegateDialogSession>) {
  const scope = useWalletScope(props.chain.genesisHash);
  return <UndelegateDialogSession key={scope} {...props} />;
}

function UndelegateDialogSession({
  chain,
  delegations,
  triggerLabel,
  variant = "line",
  onDone,
}: {
  chain: ChainConfig;
  delegations: AccountDelegation[];
  triggerLabel: string;
  variant?: "line" | "ghost" | "nay";
  onDone?: () => void;
}) {
  const { account, signer, walletSource, walletConnectGenesisHash, openWalletDialog, proxySigner } = useApp();
  const walletReady = walletCanSignOnChain(walletSource, walletConnectGenesisHash, chain.genesisHash);
  const [open, setOpen] = useState(false);
  const [mainnetApproved, setMainnetApproved] = useState(false);
  const [progress, setProgress] = useState<VoteProgress | null>(null);
  // Finality arrives after the dialog may have been closed and reopened; ignore stale updates.
  const session = useRef(0);
  const submission = useSubmissionLock();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ txHash: string; blockHash: string } | null>(null);
  const submitting = progress != null && progress !== "Finalized" && !result;
  const close = () => {
    setOpen(false);
    if (result) onDone?.();
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={!delegations.length}
        onClick={() => {
          if (!account || !walletReady) {
            openWalletDialog(chain);
            return;
          }
          setError(null);
          setProgress(null);
          setResult(null);
          setMainnetApproved(false);
          session.current += 1;
          setOpen(true);
        }}
      >
        {triggerLabel}
      </Button>
      {open ? (
        <Modal titleId="undelegate-title" onClose={close} busy={submitting}>
          <Panel padding="content" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto bg-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 id="undelegate-title" className="font-display text-base text-paper">
                Undelegate {delegations.length === 1 ? delegations[0].trackName : `${delegations.length} tracks`}
              </h2>
              <TextButton type="button" tone="neutral" disabled={submitting} onClick={close} className="shrink-0">Close</TextButton>
            </div>
            {result ? (
              <div className="flex flex-col gap-4">
                <Badge tone="good" className="w-fit">Finalized</Badge>
                <p className="text-sm leading-6">Undelegation is finalized on {chain.name}. The delegated balance stays locked for its conviction period.</p>
                <div className="rounded-2xl bg-panel-2 p-3 text-xs leading-5 text-mute">
                  <div className="break-all">Transaction <a className="num text-link" href={`${chain.subscanUrl}/extrinsic/${result.txHash}`} target="_blank" rel="noreferrer">{result.txHash}</a></div>
                  <div className="mt-1 break-all">Block <a className="num text-link" href={`${chain.subscanUrl}/block/${result.blockHash}`} target="_blank" rel="noreferrer">{result.blockHash}</a></div>
                </div>
                <Button type="button" onClick={close}>Done</Button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (submitting || !account || !signer || !walletReady || (!chain.testnet && !mainnetApproved) || !submission.begin()) return;
                  setError(null);
                  const id = session.current;
                  try {
                    const receipt = await submitUndelegation({
                      rpc: chain.rpc,
                      genesisHash: chain.genesisHash,
                      trackIds: delegations.map((item) => item.trackId),
                      address: account,
                      signer,
                      walletSource,
                      signAs: proxySigner,
                      onProgress: ((id) => (next: VoteProgress) => {
                        if (submission.active() && session.current === id) setProgress(next);
                        const phase = governanceInclusionPhase(next);
                        if (phase) notifyGovernanceChanged({ reason: "delegation", phase, voter: account });
                      })(session.current),
                    });
                    if (submission.active() && session.current === id) setResult(receipt);
                  } catch (submitError) {
                    if (!submission.active() || session.current !== id) return;
                    setProgress(null);
                    setError(submitError instanceof Error ? submitError.message : "Undelegation failed");
                  } finally { submission.end(); }
                }}
              >
                <ul className="divide-y divide-line border-y border-line text-sm">
                  {delegations.map((item) => (
                    <li key={item.trackId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>{item.trackId} · {item.trackName}</span>
                      <span className="num text-xs text-mute">{formatPlanck(item.balance, chain)} · {convictionFromName(item.conviction)} → {shortAddr(item.target)}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-5 text-mute">
                  {delegations.length > 1 ? "All tracks are undelegated in one utility.batchAll transaction. " : ""}
                  Your voting power returns to you; the balance stays locked for the conviction period before it can be unlocked.
                </p>
                {!chain.testnet ? (
                  <label className="flex items-start gap-2 text-sm leading-6 text-mute">
                    <Checkbox name="mainnet-approval" className="mt-1.5" checked={mainnetApproved} disabled={submitting} onChange={(event) => setMainnetApproved(event.target.checked)} />
                    <span>I understand this submits a real {chain.symbol} Asset Hub transaction and may charge a fee.</span>
                  </label>
                ) : (
                  <p className="text-xs leading-5 text-mute">Testnet transaction; PAS has no monetary value. A network fee still applies.</p>
                )}
                <ProxyNote />
                {error ? <p className="text-sm text-nay" role="alert">{error}</p> : null}
                {progress ? <p className="text-sm text-link" aria-live="polite">{progress}…</p> : null}
                <Button type="submit" disabled={!signer || !walletReady || submitting || (!chain.testnet && !mainnetApproved)}>
                  {submitting ? "Submitting…" : "Sign & undelegate"}
                </Button>
              </form>
            )}
          </Panel>
        </Modal>
      ) : null}
    </>
  );
}

/** Reads the connected account's on-chain delegations and loads them again when `reload` is called. */
export function useAccountDelegations(chain: ChainConfig, account: string | null | undefined, enabled = true) {
  const [loaded, setLoaded] = useState<{ key: string; delegations: AccountDelegation[] | null; error: string | null } | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const key = enabled && account ? `${chain.genesisHash}|${account}|${version}` : null;
  useEffect(() => {
    if (!account || !key) return;
    let cancelled = false;
    readAccountDelegations({ rpc: chain.rpc, genesisHash: chain.genesisHash, address: account })
      .then((delegations) => {
        if (!cancelled) setLoaded({ key, delegations, error: null });
      })
      .catch((loadError) => {
        const error = loadError instanceof Error ? loadError.message : "Could not read delegations";
        if (!cancelled) setLoaded({ key, delegations: null, error });
      });
    return () => { cancelled = true; };
  }, [chain.rpc, chain.genesisHash, account, key]);
  const current = loaded?.key === key ? loaded : null;
  return { delegations: current?.delegations ?? null, error: current?.error ?? null, reload };
}

/** Account page panel: on-chain delegations with undelegate and change actions. */
export function AccountDelegations() {
  const { account } = useApp();
  const chain = useChain();
  const chainHref = useChainHref();
  const { delegations, error, reload } = useAccountDelegations(chain, account);
  return (
    <Panel padding="content" className="max-w-2xl">
      <ModuleHeader
        title="Delegations"
        meta={delegations && delegations.length > 1 ? <UndelegateDialog chain={chain} delegations={delegations} triggerLabel="Undelegate all" variant="ghost" onDone={reload} /> : undefined}
      />
      {error ? (
        <p className="text-sm text-nay" role="alert">Could not read delegations from {chain.name}: {error}</p>
      ) : delegations == null ? (
        <p className="text-sm text-mute" role="status">Reading delegations from {chain.name}…</p>
      ) : delegations.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-mute">This account is not delegating on any OpenGov track.</p>
          <ArrowLink href={chainHref("/delegation/")}>Find a delegate</ArrowLink>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {delegations.map((item) => (
            <li key={item.trackId} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 text-sm">
                <div className="text-paper">{item.trackId} · {item.trackName}</div>
                <div className="num mt-1 text-xs text-mute">
                  {formatPlanck(item.balance, chain)} · {convictionFromName(item.conviction)} → <Link className="text-link" href={chainHref(`/delegation/${encodeURIComponent(item.target)}/`)} title={item.target}>{shortAddr(item.target, 6)}</Link>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ButtonLink variant="ghost" href={chainHref("/delegation/")}>Change</ButtonLink>
                <UndelegateDialog chain={chain} delegations={[item]} triggerLabel="Undelegate" onDone={reload} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
