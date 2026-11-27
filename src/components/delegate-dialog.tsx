"use client";

import { useSubmissionLock, useWalletScope } from "@/hooks/use-submission-lock";

import { ProxyNote } from "@/components/wallet-extras";
import { Modal } from "@/components/modal";
import { useApp } from "@/components/app-state";
import { ArrowLink, Badge, Button, Checkbox, Field, Panel, Select, TextButton } from "@/components/ui";
import { ConvictionFields } from "@/components/conviction-field";
import { governanceChains } from "@/lib/chains";
import { shortAddr } from "@/lib/format";
import type { Track } from "@/lib/types";
import { convictionFromName, submitDelegation, type Conviction, type VoteProgress } from "@/lib/vote";
import { notifyGovernanceChanged } from "@/lib/governance-sync";
import { governanceInclusionPhase } from "@/lib/referendum-tally";
import { walletCanSignOnChain } from "@/lib/wallet-chain";
import { preconnectChainApi } from "@/lib/chain-api";
import { formatPlanck, useAccountDelegations } from "@/components/undelegate";
import { useChainFromUrl, useChainHref } from "@/hooks/use-chain-href";
import { useEffect, useRef, useState } from "react";

export function DelegateDialog(props: { target: string; label?: string; tracks: Track[] }) {
  const network = useChainFromUrl();
  const scope = useWalletScope(governanceChains[network].genesisHash);
  return <DelegateDialogSession key={`${scope}:${props.target}`} {...props} />;
}

function DelegateDialogSession({ target, label, tracks }: { target: string; label?: string; tracks: Track[] }) {
  const { account, signer, walletSource, walletConnectGenesisHash, openWalletDialog, proxySigner, readOnly } = useApp();
  const network = useChainFromUrl();
  const chain = governanceChains[network];
  const walletReady = walletCanSignOnChain(walletSource, walletConnectGenesisHash, chain.genesisHash);
  const [open, setOpen] = useState(false);
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? 0);
  const [amount, setAmount] = useState("");
  const [conviction, setConviction] = useState<Conviction>("1x");
  const [mainnetApproved, setMainnetApproved] = useState(false);
  const [progress, setProgress] = useState<VoteProgress | null>(null);
  // Finality arrives after the dialog may have been closed and reopened; ignore stale updates.
  const session = useRef(0);
  const submission = useSubmissionLock();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ txHash: string; blockHash: string } | null>(null);
  const submitting = progress != null && progress !== "Finalized" && !result;
  const chainHref = useChainHref();
  useEffect(() => {
    if (account && walletReady && tracks.length) preconnectChainApi(chain.rpc, chain.genesisHash);
  }, [account, walletReady, tracks.length, chain.rpc, chain.genesisHash]);
  const { delegations, error: loadError, reload } = useAccountDelegations(chain, account, open);
  const current = delegations?.find((item) => item.trackId === trackId) ?? null;
  const sameTarget = current != null && current.target === target;
  const submitDisabled = !account || !signer || !walletReady || submitting || !delegations
    || !amount.trim() || (!chain.testnet && !mainnetApproved);

  return (
    <>
      <Button
        type="button"
        variant="line"
        disabled={!tracks.length}
        title={tracks.length ? undefined : "OpenGov tracks are unavailable"}
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
          reload();
          setOpen(true);
        }}
      >
        Delegate
      </Button>
      {account && !walletReady ? <p className="mt-2 text-xs text-mute">{readOnly ? "This is a watch-only address. Connect a signing wallet to delegate." : walletSource === "wallet-connect" ? `Reconnect WalletConnect to ${chain.name} before delegating.` : `Connect a signing wallet to ${chain.name} before delegating.`}</p> : null}
      {open ? (
        <Modal titleId="delegate-title" onClose={() => setOpen(false)} busy={submitting}>
          <Panel padding="content" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto bg-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="delegate-title" className="font-display text-base text-paper">Delegate voting power</h2>
                <p className="mt-1 truncate text-sm text-mute">to {label || shortAddr(target, 6)}</p>
              </div>
              <TextButton type="button" tone="neutral" disabled={submitting} onClick={() => setOpen(false)} className="shrink-0">
                Close
              </TextButton>
            </div>
            {result ? (
              <div className="flex flex-col gap-4">
                <Badge tone="good" className="w-fit">Finalized</Badge>
                <p className="text-sm leading-6">Your delegation is finalized on {chain.name}.</p>
                <div className="rounded-2xl bg-panel-2 p-3 text-xs leading-5 text-mute">
                  <div className="break-all">Transaction <a className="num text-link" href={`${chain.subscanUrl}/extrinsic/${result.txHash}`} target="_blank" rel="noreferrer">{result.txHash}</a></div>
                  <div className="mt-1 break-all">Block <a className="num text-link" href={`${chain.subscanUrl}/block/${result.blockHash}`} target="_blank" rel="noreferrer">{result.blockHash}</a></div>
                </div>
                <Button type="button" onClick={() => setOpen(false)}>Done</Button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (submitDisabled || !account || !signer || !submission.begin()) return;
                  setError(null);
                  const submissionSession = session.current;
                  try {
                    const receipt = await submitDelegation({
                      rpc: chain.rpc,
                      genesisHash: chain.genesisHash,
                      trackId,
                      expectedDelegation: current,
                      target,
                      amount,
                      decimals: chain.decimals,
                      conviction,
                      address: account,
                      signer,
                      walletSource,
                      signAs: proxySigner,
                      onProgress: (next) => {
                        if (submission.active() && session.current === submissionSession) setProgress(next);
                        const phase = governanceInclusionPhase(next);
                        if (phase) notifyGovernanceChanged({ reason: "delegation", phase, trackId, voter: account });
                      },
                    });
                    if (submission.active() && session.current === submissionSession) setResult(receipt);
                  } catch (submitError) {
                    if (!submission.active() || session.current !== submissionSession) return;
                    setProgress(null);
                    setError(submitError instanceof Error ? submitError.message : "Delegation submission failed");
                    reload();
                  } finally { submission.end(); }
                }}
              >
                <div className="grid gap-2 border-y border-line py-3 text-sm sm:grid-cols-[7rem_1fr]">
                  <span className="text-mute">Network</span>
                  <span>{chain.name}{chain.testnet ? " · testnet" : " · mainnet"}</span>
                  <span className="text-mute">Delegate</span>
                  <span className="num break-all text-xs">{target}</span>
                  <span className="text-mute">From</span>
                  <span className="num break-all text-xs">{account ?? "Wallet not connected"}</span>
                </div>
                <Field label="OpenGov track">
                  <Select name="track" value={trackId} disabled={submitting} onChange={(event) => setTrackId(Number(event.target.value))}>
                    {tracks.map((track) => <option key={track.id} value={track.id}>{track.id} · {track.displayName}</option>)}
                  </Select>
                </Field>
                {current ? (
                  <div className="flex flex-col gap-2 rounded-2xl bg-panel-2 px-4 py-3 text-xs leading-5 text-mute">
                    <p>
                      This track is delegated {sameTarget ? "to this delegate" : <>to <span className="num text-paper" title={current.target}>{shortAddr(current.target, 6)}</span></>}: <b className="num font-semibold text-paper">{formatPlanck(current.balance, chain)} · {convictionFromName(current.conviction)}</b>.
                      Signing replaces it in one batch. The previous balance stays locked for its original conviction period.
                    </p>
                    <ArrowLink size="sm" href={chainHref("/account/")}>Undelegate it from your account page instead</ArrowLink>
                  </div>
                ) : null}
                {loadError ? (
                  <div className="flex items-center gap-2 text-sm text-nay">
                    <p role="alert">Could not check the current delegation. {loadError}</p>
                    <TextButton type="button" onClick={reload}>Retry</TextButton>
                  </div>
                ) : !delegations ? <p className="text-sm text-mute" role="status">Checking current delegations…</p> : null}
                <ConvictionFields amount={amount} onAmount={setAmount} conviction={conviction} onConviction={setConviction} symbol={chain.symbol} disabled={submitting} />
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
                <Button type="submit" disabled={submitDisabled}>
                  {submitting ? "Submitting…" : current ? "Sign & change delegation" : "Sign & delegate"}
                </Button>
              </form>
            )}
          </Panel>
        </Modal>
      ) : null}
    </>
  );
}
