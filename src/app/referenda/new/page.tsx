"use client";

import { useSubmissionLock, useWalletScope } from "@/hooks/use-submission-lock";

import { useApp } from "@/components/app-state";
import { ArrowLink, Badge, Button, Checkbox, ChoiceButton, ChoiceGroup, Field, Input, ModuleHeader, PageHeader, Panel, Select, Textarea } from "@/components/ui";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import { shortAddr } from "@/lib/format";
import { walletCanSignOnChain } from "@/lib/wallet-chain";
import {
  getProposalCapabilities,
  prepareProposal,
  submitProposal,
  type ProposalCapabilities,
  type ProposalDraft,
  type ProposalPreview,
  type ProposalProgress,
  type ProposalTemplate,
} from "@/lib/proposal";
import { useEffect, useMemo, useState } from "react";

type Spend = { symbol: string; amount: string; beneficiary: string; validFrom: string };

const templates: Array<{ id: ProposalTemplate; group: "Quick start" | "More templates" | "Create from a preimage"; title: string; description: string }> = [
  { id: "treasury", group: "Quick start", title: "Treasury proposal", description: "Approve a native treasury spend paid after the treasury award period." },
  { id: "usdx-treasury", group: "Quick start", title: "USDx treasury proposal", description: "Create an Asset Hub treasury spend using a supported stable asset." },
  { id: "batch-treasury", group: "Quick start", title: "Batch treasury spends", description: "Combine several treasury spends into one proposal call." },
  { id: "multi-asset-bounty", group: "Quick start", title: "Multi-asset bounty proposal", description: "Fund a bounty with an Asset Hub asset and nominate a curator." },
  { id: "remark", group: "More templates", title: "Remark", description: "Create a proposal containing an on-chain system remark." },
  { id: "cancel", group: "More templates", title: "Cancel a referendum", description: "Cancel an ongoing referendum and return its deposits." },
  { id: "kill", group: "More templates", title: "Kill a referendum", description: "Kill an ongoing referendum and slash its deposits." },
  { id: "new-preimage", group: "Create from a preimage", title: "New preimage", description: "Register encoded call data and submit it as a referendum." },
  { id: "existing-preimage", group: "Create from a preimage", title: "I already have a preimage", description: "Submit a registered preimage by its hash and encoded length." },
];

const groups = ["Quick start", "More templates", "Create from a preimage"] as const;

export default function NewProposalPage() {
  const chain = useChain();
  const scope = useWalletScope(chain.genesisHash);
  return <NewProposalForm key={scope} />;
}

function NewProposalForm() {
  const chain = useChain();
  const chainHref = useChainHref();
  // Proposals are submitted from the wallet account itself, not through a proxy.
  const { signerAccount: account, signer, walletSource, walletConnectGenesisHash, readOnly } = useApp();
  const walletReady = walletCanSignOnChain(walletSource, walletConnectGenesisHash, chain.genesisHash);
  const network = useMemo(() => ({ rpc: chain.rpc, genesisHash: chain.genesisHash, decimals: chain.decimals, symbol: chain.symbol }), [chain]);
  const submission = useSubmissionLock();
  const [capabilities, setCapabilities] = useState<ProposalCapabilities | null>(null);
  const [template, setTemplate] = useState<ProposalTemplate>("treasury");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [spends, setSpends] = useState<Spend[]>([{ symbol: chain.symbol, amount: "", beneficiary: "", validFrom: "" }]);
  const [origin, setOrigin] = useState("");
  const [enactmentBlocks, setEnactmentBlocks] = useState("0");
  const [preview, setPreview] = useState<ProposalPreview | null>(null);
  const [reviewedDraft, setReviewedDraft] = useState<ProposalDraft | null>(null);
  const [progress, setProgress] = useState<ProposalProgress | null>(null);
  const [error, setError] = useState("");
  const [mainnetApproved, setMainnetApproved] = useState(false);
  const [result, setResult] = useState<{ txHash: string; blockHash: string; referendumIndex: number } | null>(null);

  useEffect(() => {
    let active = true;
    setCapabilities(null);
    setError("");
    setFields({});
    setPreview(null);
    setReviewedDraft(null);
    setResult(null);
    setMainnetApproved(false);
    setProgress(null);
    void getProposalCapabilities(network).then((next) => {
      if (!active) return;
      setCapabilities(next);
      const first = next.origins.find((item) => item.label.toLowerCase().includes("small spender")) ?? next.origins[0];
      if (first) {
        setOrigin(first.value);
        setEnactmentBlocks(String(first.minEnactmentBlocks));
      }
      setSpends([{ symbol: chain.symbol, amount: "", beneficiary: "", validFrom: "" }]);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Unable to read network capabilities");
    });
    return () => { active = false; };
  }, [chain.symbol, network]);

  const selected = templates.find((item) => item.id === template)!;
  const capability = capabilities?.templates[template];
  const allowedOrigins = capabilities?.origins.filter((item) => capability?.allowedOrigins.includes(item.value)) ?? [];
  const submitting = progress != null && progress !== "Finalized";
  const defaultAsset = capabilities?.assets[0];
  const draftFields = ["usdx-treasury", "multi-asset-bounty"].includes(template) && defaultAsset
    ? { symbol: defaultAsset.symbol, assetId: defaultAsset.assetId, assetDecimals: String(defaultAsset.decimals), ...fields }
    : fields;
  const serializedSpends = spends.map((spend) => {
    const asset = capabilities?.assets.find((item) => item.symbol === spend.symbol);
    return asset ? { ...spend, assetId: asset.assetId, assetDecimals: String(asset.decimals) } : spend;
  });
  const draft: ProposalDraft = {
    template,
    fields: template === "batch-treasury" ? { ...draftFields, spends: JSON.stringify(serializedSpends) } : draftFields,
    origin,
    enactmentBlocks,
  };

  const invalidate = () => {
    setPreview(null);
    setReviewedDraft(null);
    setResult(null);
    setError("");
    setMainnetApproved(false);
  };
  const updateField = (name: string, value: string) => {
    invalidate();
    setFields((current) => ({ ...current, [name]: value }));
  };
  const chooseTemplate = (id: ProposalTemplate) => {
    const nextCapability = capabilities?.templates[id];
    const validOrigins = capabilities?.origins.filter((item) => nextCapability?.allowedOrigins.includes(item.value)) ?? [];
    const preferred = validOrigins.find((item) => {
      const label = item.label.toLowerCase();
      if (id === "cancel") return label.includes("canceller");
      if (id === "kill") return label.includes("killer");
      if (["treasury", "usdx-treasury", "batch-treasury", "multi-asset-bounty"].includes(id)) return label.includes("small spender");
      return label === "root";
    }) ?? validOrigins[0];
    setTemplate(id);
    setFields({});
    setPreview(null);
    setReviewedDraft(null);
    setResult(null);
    setError("");
    setMainnetApproved(false);
    if (preferred) {
      setOrigin(preferred.value);
      setEnactmentBlocks(String(preferred.minEnactmentBlocks));
    }
    if (id === "batch-treasury") setSpends([{ symbol: chain.symbol, amount: "", beneficiary: "", validFrom: "" }]);
    document.getElementById("proposal-workbench")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        kicker={`${chain.name} · live`}
        title="Submit proposal"
        description="Build the call, verify its preimage, then sign the referendum submission with your wallet. Nothing is sent before the final confirmation."
        back={{ href: chainHref("/referenda/"), label: "Referenda" }}
      />

      <ol className="proposal-steps" aria-label="Progress">
        {(["Template", "Details", "Review and sign"] as const).map((label, index) => {
          const current = preview ? 2 : 1;
          const state = index < current ? "done" : index === current ? "current" : "todo";
          return (
            <li key={label} className="proposal-step" data-state={state} aria-current={state === "current" ? "step" : undefined}>
              <span className="proposal-step-index num" aria-hidden="true">{index + 1}</span>
              {label}
            </li>
          );
        })}
      </ol>

      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-[minmax(15rem,0.65fr)_minmax(0,1.35fr)]">
        <div className="min-w-0 xl:hidden">
          <Field label="Proposal template">
            <Select name="template" value={template} disabled={!capabilities || submitting} onChange={(event) => chooseTemplate(event.target.value as typeof template)}>
              {groups.map((group) => <optgroup key={group} label={group}>{templates.filter((item) => item.group === group).map((item) => <option key={item.id} value={item.id} disabled={capabilities?.templates[item.id]?.enabled === false}>{item.title}{capabilities?.templates[item.id]?.enabled === false ? " · Unavailable" : ""}</option>)}</optgroup>)}
            </Select>
          </Field>
          <p className="mt-2 text-xs leading-5 text-mute">{capability?.reason ?? selected.description}</p>
          {capabilities && templates.some((item) => capabilities.templates[item.id]?.enabled === false) ? <details className="mt-3 text-sm">
            <summary className="cursor-pointer py-2 text-mute">Unavailable templates</summary>
            <ul className="mt-2 space-y-3">{templates.filter((item) => capabilities.templates[item.id]?.enabled === false).map((item) => <li key={item.id}><span className="font-semibold">{item.title}</span><p className="mt-1 text-xs leading-5 text-mute">{capabilities.templates[item.id]?.reason ?? "Unavailable on this runtime."}</p></li>)}</ul>
          </details> : null}
        </div>
        <nav aria-label="Proposal templates" className="hidden space-y-7 xl:sticky xl:top-24 xl:block">
          {groups.map((group) => (
            <section key={group} aria-labelledby={`group-${group.replaceAll(" ", "-")}`}>
              <div className="mb-2 flex items-center gap-3">
                <h2 id={`group-${group.replaceAll(" ", "-")}`} className="text-sm font-medium text-paper">{group}</h2>
                <span className="h-px flex-1 bg-line" />
              </div>
              <ChoiceGroup aria-labelledby={`group-${group.replaceAll(" ", "-")}`}>
                {templates.filter((item) => item.group === group).map((item) => {
                  const state = capabilities?.templates[item.id];
                  const disabled = !capabilities || state?.enabled === false;
                  return (
                    <ChoiceButton
                      key={item.id}
                      type="button"
                      variant="list"
                      selected={template === item.id}
                      disabled={disabled || submitting}
                      title={state?.reason}
                      onClick={() => chooseTemplate(item.id)}
                      className="group text-paper"
                    >
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${template === item.id ? "bg-brass" : "bg-line-2 group-hover:bg-brass/70"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                          {item.title}
                          {state?.enabled === false ? <Badge>Unavailable</Badge> : null}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-mute">{state?.reason ?? item.description}</span>
                      </span>
                    </ChoiceButton>
                  );
                })}
              </ChoiceGroup>
            </section>
          ))}
        </nav>

        <section id="proposal-workbench" className="min-w-0 scroll-mt-24">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Badge tone={capability?.enabled ? "live" : "muted"}>{capabilities ? capabilities.runtime.specName : "Connecting"}</Badge>
                {capabilities ? <span className="num text-xs text-mute">runtime {capabilities.runtime.specVersion}</span> : null}
              </div>
              <h2 className="mt-2 font-display text-base text-paper">{selected.title}</h2>
              <p className="mt-1 hidden max-w-2xl text-sm leading-6 text-mute xl:block">{capability?.reason ?? selected.description}</p>
            </div>
          </div>

          {error && !capabilities ? <Panel padding="compact" className="border-nay/40 text-sm text-nay" role="alert">{error}</Panel> : null}
          {capabilities && capability?.enabled ? (
            <form
              className="space-y-7"
              onSubmit={async (event) => {
                event.preventDefault();
                if (submitting || !submission.begin()) return;
                setError("");
                try {
                  if (!preview) {
                    setProgress("Validating proposal");
                    const reviewed = draft;
                    const prepared = await prepareProposal(network, reviewed);
                    if (!submission.active()) return;
                    setPreview(prepared);
                    setReviewedDraft(reviewed);
                    setProgress(null);
                    return;
                  }
                  if (!account || !signer) throw new Error("Connect a wallet from the header before submitting");
                  if (!walletReady) throw new Error(`Connect WalletConnect to ${chain.name} before submitting`);
                  if (!chain.testnet && !mainnetApproved) throw new Error("Confirm the mainnet transaction before submitting");
                  if (!reviewedDraft) throw new Error("Review the proposal again before submitting");
                  const receipt = await submitProposal({ network, draft: reviewedDraft, address: account, signer, onProgress: (next) => { if (submission.active()) setProgress(next); } });
                  if (submission.active()) setResult(receipt);
                } catch (cause) {
                  if (!submission.active()) return;
                  setProgress(null);
                  setError(cause instanceof Error ? cause.message : "Proposal submission failed");
                } finally { submission.end(); }
              }}
            >
              <fieldset disabled={submitting} className="contents">
              <Panel padding="content">
                <ModuleHeader title="Call parameters" />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <TemplateFields
                    template={template}
                    fields={fields}
                    spends={spends}
                    setSpends={(next) => { invalidate(); setSpends(next); }}
                    updateField={updateField}
                    capabilities={capabilities}
                    nativeSymbol={chain.symbol}
                  />
                </div>
              </Panel>

              <Panel padding="content">
                <ModuleHeader title="Governance" />
                <p className="text-xs text-mute">Origin selects the OpenGov track and permissions.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Proposal origin / track">
                    <Select
                      name="origin"
                      value={origin}
                      disabled={submitting}
                      onChange={(event) => {
                        invalidate();
                        const next = allowedOrigins.find((item) => item.value === event.target.value);
                        setOrigin(event.target.value);
                        if (next) setEnactmentBlocks(String(next.minEnactmentBlocks));
                      }}
                    >
                      {allowedOrigins.map((item) => <option key={item.value} value={item.value}>#{item.trackId} · {item.label}</option>)}
                    </Select>
                  </Field>
                  <Field label="Enactment delay (blocks)">
                    <Input name="enactment-blocks" autoComplete="off" type="number" min="0" step="1" value={enactmentBlocks} disabled={submitting} onChange={(event) => { invalidate(); setEnactmentBlocks(event.target.value); }} />
                  </Field>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                  <span className="text-mute">{readOnly ? "Watch-only account" : "Signing account"}</span>
                  <span className={account ? "num text-paper" : "text-mute"}>{account ? shortAddr(account) : "Connect a wallet in the header"}</span>
                </div>
                {account && readOnly ? <p className="mt-2 text-xs text-mute">Connect a signing wallet from the header to submit. You can still review the proposal.</p> : account && walletSource === "wallet-connect" && !walletReady ? <p className="mt-2 text-xs text-nay">Reconnect WalletConnect to {chain.name} from the header before signing.</p> : null}
              </Panel>

              {preview ? <ProposalReview preview={preview} /> : null}

              {!chain.testnet && preview ? (
                <label className="flex items-start gap-2 text-sm text-mute">
                  <Checkbox name="mainnet-approval" className="mt-1" checked={mainnetApproved} disabled={submitting} onChange={(event) => setMainnetApproved(event.target.checked)} />
                  <span>I understand this submits a real {chain.symbol} mainnet transaction, reserves a submission deposit, and charges network fees.</span>
                </label>
              ) : preview ? <p className="text-xs text-mute">Testnet transaction. A submission deposit and network fee still apply.</p> : null}

              {error ? <p className="text-sm text-nay" role="alert">{error}</p> : null}
              {progress ? <p className="text-sm text-link" aria-live="polite">{progress}…</p> : null}
              {result ? (
                <Panel padding="compact" className="border-aye/40">
                  <div className="flex items-center gap-2"><Badge tone="good">Finalized</Badge><span className="text-sm">Referendum #{result.referendumIndex} was submitted.</span></div>
                  <div className="mt-3 space-y-1 text-xs text-mute">
                    <a className="block break-all text-link hover:underline" href={`${chain.subscanUrl}/extrinsic/${result.txHash}`} target="_blank" rel="noreferrer">Transaction · <span className="num">{result.txHash}</span> ↗</a>
                    <a className="block break-all text-link hover:underline" href={`${chain.subscanUrl}/block/${result.blockHash}`} target="_blank" rel="noreferrer">Block · <span className="num">{result.blockHash}</span> ↗</a>
                  </div>
                  <ArrowLink className="mt-4" href={chainHref(`/referenda/${result.referendumIndex}/`)}>Open referendum</ArrowLink>
                </Panel>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {preview ? <Button type="button" variant="ghost" disabled={submitting} onClick={() => setPreview(null)}>Edit call</Button> : null}
                  <Button type="submit" disabled={submitting || Boolean(preview && (!account || !signer || !walletReady || (!chain.testnet && !mainnetApproved)))}>
                    {submitting ? progress : preview ? "Sign & submit" : "Review proposal"}
                  </Button>
                </div>
              )}
              </fieldset>
            </form>
          ) : capabilities ? <Panel padding="content" className="text-sm text-mute">{capability?.reason ?? "This template is not available on the selected runtime."}</Panel> : !error ? <Panel padding="content" className="text-sm text-mute">Reading live runtime metadata…</Panel> : null}
        </section>
      </div>
    </div>
  );
}

function TemplateFields({ template, fields, spends, setSpends, updateField, capabilities, nativeSymbol }: {
  template: ProposalTemplate;
  fields: Record<string, string>;
  spends: Spend[];
  setSpends: (spends: Spend[]) => void;
  updateField: (name: string, value: string) => void;
  capabilities: ProposalCapabilities;
  nativeSymbol: string;
}) {
  const assetOptions = capabilities.assets;
  const selectedAsset = assetOptions.find((item) => item.symbol === fields.symbol) ?? assetOptions[0];
  const setAsset = (symbol: string) => {
    const asset = assetOptions.find((item) => item.symbol === symbol);
    if (!asset) return;
    updateField("symbol", asset.symbol);
    updateField("assetId", asset.assetId);
    updateField("assetDecimals", String(asset.decimals));
  };
  if (template === "remark") return <div className="sm:col-span-2"><Field label="Remark"><Textarea name="remark" autoComplete="off" required maxLength={4096} value={fields.remark ?? ""} placeholder="Proposal remark" onChange={(event) => updateField("remark", event.target.value)} /></Field></div>;
  if (template === "cancel" || template === "kill") return <Field label="Referendum ID"><Input name="referendum-id" autoComplete="off" required type="number" min="0" step="1" value={fields.referendumId ?? ""} onChange={(event) => updateField("referendumId", event.target.value)} /></Field>;
  if (template === "new-preimage") return <div className="sm:col-span-2"><Field label="Encoded call data"><Textarea name="call-data" autoComplete="off" required className="num min-h-36" spellCheck={false} value={fields.callHex ?? ""} placeholder="0x…" onChange={(event) => updateField("callHex", event.target.value)} /></Field></div>;
  if (template === "existing-preimage") return <><Field label="Preimage hash"><Input name="preimage-hash" autoComplete="off" required className="num" value={fields.hash ?? ""} placeholder="0x…" onChange={(event) => updateField("hash", event.target.value)} /></Field><Field label="Encoded length (bytes)"><Input name="preimage-length" autoComplete="off" required type="number" min="1" step="1" value={fields.len ?? ""} onChange={(event) => updateField("len", event.target.value)} /></Field></>;
  if (template === "batch-treasury") return (
    <div className="space-y-4 sm:col-span-2">
      {spends.map((spend, index) => (
        <div key={index} className="grid gap-3 border-t border-line pt-4 first:border-0 first:pt-0 2xl:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1.4fr)_auto]">
          <Field label="Asset"><Select name={`spends.${index}.symbol`} value={spend.symbol} onChange={(event) => setSpends(spends.map((item, i) => i === index ? { ...item, symbol: event.target.value } : item))}><option value={nativeSymbol}>{nativeSymbol}</option>{assetOptions.map((asset) => <option key={asset.assetId} value={asset.symbol}>{asset.symbol}</option>)}</Select></Field>
          <Field label="Amount"><Input name={`spends.${index}.amount`} autoComplete="off" required inputMode="decimal" value={spend.amount} onChange={(event) => setSpends(spends.map((item, i) => i === index ? { ...item, amount: event.target.value } : item))} /></Field>
          <Field label="Beneficiary"><Input name={`spends.${index}.beneficiary`} autoComplete="off" required className="num" value={spend.beneficiary} onChange={(event) => setSpends(spends.map((item, i) => i === index ? { ...item, beneficiary: event.target.value } : item))} /></Field>
          <Button type="button" variant="ghost" className="self-end" disabled={spends.length === 1} onClick={() => setSpends(spends.filter((_, i) => i !== index))}>Remove</Button>
        </div>
      ))}
      <Button type="button" variant="line" onClick={() => setSpends([...spends, { symbol: nativeSymbol, amount: "", beneficiary: "", validFrom: "" }])}>Add payout</Button>
    </div>
  );
  if (template === "treasury") return <><Field label={`Amount (${nativeSymbol})`}><Input name="amount" autoComplete="off" required inputMode="decimal" value={fields.amount ?? ""} onChange={(event) => updateField("amount", event.target.value)} /></Field><Field label="Beneficiary"><Input name="beneficiary" autoComplete="off" required className="num" value={fields.beneficiary ?? ""} onChange={(event) => updateField("beneficiary", event.target.value)} /></Field></>;
  if (template === "usdx-treasury") return <><Field label="Asset"><Select name="asset" required value={selectedAsset?.symbol ?? ""} onChange={(event) => setAsset(event.target.value)}>{assetOptions.map((asset) => <option key={asset.assetId} value={asset.symbol}>{asset.symbol}</option>)}</Select></Field><Field label={`Amount (${selectedAsset?.symbol ?? "asset"})`}><Input name="amount" autoComplete="off" required inputMode="decimal" value={fields.amount ?? ""} onFocus={() => selectedAsset && !fields.symbol && setAsset(selectedAsset.symbol)} onChange={(event) => updateField("amount", event.target.value)} /></Field><Field label="Beneficiary"><Input name="beneficiary" autoComplete="off" required className="num" value={fields.beneficiary ?? ""} onChange={(event) => updateField("beneficiary", event.target.value)} /></Field><Field label="Valid from block (optional)"><Input name="valid-from" autoComplete="off" type="number" min="0" step="1" value={fields.validFrom ?? ""} onChange={(event) => updateField("validFrom", event.target.value)} /></Field></>;
  return <><Field label="Asset"><Select name="asset" required value={selectedAsset?.symbol ?? ""} onChange={(event) => setAsset(event.target.value)}>{assetOptions.map((asset) => <option key={asset.assetId} value={asset.symbol}>{asset.symbol}</option>)}</Select></Field><Field label={`Amount (${selectedAsset?.symbol ?? "asset"})`}><Input name="amount" autoComplete="off" required inputMode="decimal" value={fields.amount ?? ""} onFocus={() => selectedAsset && !fields.symbol && setAsset(selectedAsset.symbol)} onChange={(event) => updateField("amount", event.target.value)} /></Field><Field label="Curator"><Input name="curator" autoComplete="off" required className="num" value={fields.curator ?? ""} onChange={(event) => updateField("curator", event.target.value)} /></Field><div className="sm:col-span-2"><Field label="Bounty description"><Textarea name="description" autoComplete="off" required value={fields.description ?? ""} onChange={(event) => updateField("description", event.target.value)} /></Field></div></>;
}

function ProposalReview({ preview }: { preview: ProposalPreview }) {
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 sm:px-5">
        <h3 className="font-display text-lg text-paper">Review encoded call</h3>
        <Badge tone="brass">{preview.submissionMethod}</Badge>
      </div>
      <dl className="divide-y divide-line text-sm">
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:px-5"><dt className="text-mute">Runtime call</dt><dd className="num text-paper">{preview.method}</dd></div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:px-5"><dt className="text-mute">Preimage hash</dt><dd className="num break-all text-paper">{preview.callHash}</dd></div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:px-5"><dt className="text-mute">Encoded length</dt><dd className="num text-paper">{preview.callLength} bytes</dd></div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:px-5"><dt className="text-mute">Preimage</dt><dd className="text-paper">{preview.preimageExists ? "Already registered" : "Will be registered atomically with submission"}</dd></div>
        <div className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:px-5"><dt className="text-mute">Call data</dt><dd className="num max-h-28 overflow-auto break-all text-xs leading-5 text-paper">{preview.callHex}</dd></div>
      </dl>
    </Panel>
  );
}
