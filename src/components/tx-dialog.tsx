"use client";

import { useSubmissionLock, useWalletScope } from "@/hooks/use-submission-lock";

import { ProxyNote } from "@/components/wallet-extras";
import { useApp } from "@/components/app-state";
import { Modal } from "@/components/modal";
import { Badge, Button, Checkbox, Panel, TextButton } from "@/components/ui";
import type { ChainConfig } from "@/lib/chains";
import { submitGovernanceTransaction, type VoteProgress } from "@/lib/vote";
import { walletCanSignOnChain } from "@/lib/wallet-chain";
import type { ApiPromise } from "@polkadot/api";
import type { SubmittableExtrinsic } from "@polkadot/api/promise/types";
import { useId, useRef, useState } from "react";

type Build = (api: ApiPromise, signer: { address: string }) => Promise<SubmittableExtrinsic | SubmittableExtrinsic[]> | SubmittableExtrinsic | SubmittableExtrinsic[];

/**
 * One confirm-and-sign dialog for governance calls other than voting: shows what will be signed, asks for mainnet
 * consent, reports progress and links the result. Several calls are wrapped in one `utility.batchAll`.
 */
export function TxDialog(props: React.ComponentProps<typeof TxDialogSession>) {
  const scope = useWalletScope(props.chain.genesisHash);
  return <TxDialogSession key={scope} {...props} />;
}

function TxDialogSession({
  chain,
  title,
  triggerLabel,
  submitLabel = "Sign & submit",
  successText,
  variant = "line",
  size,
  disabled = false,
  children,
  build,
  onDone,
}: {
  chain: ChainConfig;
  title: string;
  triggerLabel: React.ReactNode;
  submitLabel?: string;
  successText: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  disabled?: boolean;
  children?: React.ReactNode;
  build: Build;
  onDone?: () => void;
}) {
  const { account, signer, walletSource, walletConnectGenesisHash, openWalletDialog, proxySigner, readOnly } = useApp();
  const walletReady = walletCanSignOnChain(walletSource, walletConnectGenesisHash, chain.genesisHash);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [mainnetApproved, setMainnetApproved] = useState(false);
  const [progress, setProgress] = useState<VoteProgress | null>(null);
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
        size={size}
        disabled={disabled || readOnly}
        title={readOnly ? "Watch-only address. Connect a signing wallet to submit a transaction." : undefined}
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
        <Modal titleId={titleId} onClose={close} busy={submitting}>
          <Panel padding="content" className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto bg-panel">
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 id={titleId} className="font-display text-base text-paper">{title}</h2>
              <TextButton type="button" tone="neutral" disabled={submitting} onClick={close} className="shrink-0">Close</TextButton>
            </div>
            {result ? (
              <div className="flex flex-col gap-4">
                <Badge tone={progress === "Finalized" ? "good" : "live"} className="w-fit">{progress === "Finalized" ? "Finalized" : "In block · finalizing…"}</Badge>
                <p className="text-sm leading-6">{successText}</p>
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
                  if (!account || !signer || readOnly || !walletReady || submitting || (!chain.testnet && !mainnetApproved)) return;
                  if (!submission.begin()) return;
                  setError(null);
                  const id = session.current;
                  try {
                    const receipt = await submitGovernanceTransaction({
                      rpc: chain.rpc,
                      genesisHash: chain.genesisHash,
                      address: account,
                      signer,
                      walletSource,
                      signAs: proxySigner,
                      onProgress: (next) => { if (submission.active() && session.current === id) setProgress(next); },
                    }, (api) => build(api, { address: account }));
                    if (submission.active() && session.current === id) setResult(receipt);
                  } catch (submitError) {
                    if (!submission.active() || session.current !== id) return;
                    setProgress(null);
                    setError(submitError instanceof Error ? submitError.message : "Transaction failed");
                  } finally { submission.end(); }
                }}
              >
                {children}
                {!chain.testnet ? (
                  <label className="flex items-start gap-2 text-sm leading-6 text-mute">
                    <Checkbox name="mainnet-approval" className="mt-1.5" checked={mainnetApproved} disabled={submitting} onChange={(event) => setMainnetApproved(event.target.checked)} />
                    <span>I understand this submits a real {chain.symbol} Asset Hub transaction and may charge a fee.</span>
                  </label>
                ) : (
                  <p className="text-xs leading-5 text-mute">Testnet transaction; {chain.symbol} has no monetary value. A network fee still applies.</p>
                )}
                <ProxyNote />
                {error ? <p className="text-sm text-nay" role="alert">{error}</p> : null}
                {progress ? <p className="text-sm text-link" aria-live="polite">{progress}…</p> : null}
                <Button type="submit" disabled={readOnly || !signer || !walletReady || submitting || (!chain.testnet && !mainnetApproved)}>
                  {submitting ? "Signing…" : submitLabel}
                </Button>
              </form>
            )}
          </Panel>
        </Modal>
      ) : null}
    </>
  );
}
