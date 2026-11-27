"use client";

import { useApp } from "@/components/app-state";
import { CallTreeView } from "@/components/call-tree-view";
import { TxDialog } from "@/components/tx-dialog";
import { TextButton } from "@/components/ui";
import { useChain } from "@/hooks/use-chain-href";
import { sameAccount } from "@/lib/account-chain";
import { buildUnnotePreimage, decodePreimage, type DecodedProposal } from "@/lib/call-chain";
import { useState } from "react";

/** Expandable decoded call for one preimage hash. */
export function PreimageDecode({ hash, len }: { hash: string; len?: number }) {
  const chain = useChain();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ data: DecodedProposal | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: false });
  const toggle = () => {
    setOpen((value) => !value);
    if (state.data || state.loading) return;
    setState({ data: null, error: null, loading: true });
    decodePreimage({ rpc: chain.rpc, genesisHash: chain.genesisHash, hash, len })
      .then((data) => setState({ data, error: null, loading: false }))
      .catch((cause) => setState({ data: null, error: cause instanceof Error ? cause.message : "Could not decode", loading: false }));
  };
  return (
    <div className="w-full">
      <TextButton type="button" tone="neutral" onClick={toggle} aria-expanded={open}>{open ? "Hide call" : "Decode call"}</TextButton>
      {open ? (
        <div className="mt-2 rounded-2xl bg-panel-2/50 p-3">
          {state.loading ? <p className="text-xs text-mute" role="status">Reading the preimage…</p>
            : state.error ? <p className="text-xs text-nay" role="alert">{state.error}</p>
            : state.data?.status === "missing" ? <p className="text-xs text-mute">{state.data.reason}.</p>
            : state.data ? <CallTreeView node={state.data.tree} /> : null}
        </div>
      ) : null}
    </div>
  );
}

/** `preimage.unnotePreimage(hash)` for the account that noted it. */
export function UnnotePreimage({ hash, author }: { hash: string; author?: string }) {
  const chain = useChain();
  const { account } = useApp();
  if (!account || !author || !sameAccount(account, author)) return null;
  return (
    <TxDialog chain={chain} title="Unnote preimage" triggerLabel="Unnote" size="sm" submitLabel="Sign & unnote"
      successText="The preimage deposit is released. The bytes remain stored if the chain still requests them."
      build={(api, { address }) => buildUnnotePreimage(api, hash, address)}>
      <p className="text-sm leading-6">Releases your deposit for preimage <span className="num break-all">{hash}</span>. The bytes are removed only when the chain no longer requests them; a requested preimage remains available for enactment.</p>
    </TxDialog>
  );
}
