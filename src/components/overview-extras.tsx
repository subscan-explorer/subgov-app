"use client";

import { useApp } from "@/components/app-state";
import { useAccountVoting } from "@/components/account-votes";
import { ArrowLink, Button, ModuleHeader, Panel } from "@/components/ui";
import { formatPlanck } from "@/components/undelegate";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import { unlockPlan } from "@/lib/account-voting";
import { accountDeposits } from "@/lib/gov-actions";
import { useEffect, useState } from "react";

/** "My to-do" for the connected account: unlockable balance, open votes and refundable deposits. */
export function MyTodo() {
  const { account, openWalletDialog } = useApp();
  const chain = useChain();
  const chainHref = useChainHref();
  const { snapshot, error } = useAccountVoting(chain, account);
  const [refundable, setRefundable] = useState<number | null>(null);
  useEffect(() => {
    if (!account) return;
    let cancelled = false;
    accountDeposits(chain.id, account).then((result) => {
      if (!cancelled) setRefundable(result.available ? result.rows.filter((row) => row.refundable && !row.refunded).length : null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [account, chain.id]);

  if (!account) {
    return (
      <Panel padding="content">
        <ModuleHeader title="My to-do" />
        <p className="text-sm text-mute">Connect a wallet to see unlockable balance, open votes and deposits to refund.</p>
        <Button variant="ghost" className="mt-3" onClick={() => openWalletDialog()}>Connect</Button>
      </Panel>
    );
  }
  const plan = snapshot ? unlockPlan(snapshot.tracks, snapshot.now) : null;
  const open = snapshot?.tracks.reduce((n, track) => n + track.votes.filter((vote) => vote.outcome.state === "ongoing").length, 0) ?? 0;
  const items = plan ? [
    plan.releasable > BigInt(0) ? { href: "/account/votes/", text: `Unlock ${formatPlanck(plan.releasable, chain)}` } : null,
    open ? { href: "/account/votes/", text: `${open} vote${open === 1 ? "" : "s"} on open referenda` } : null,
    refundable ? { href: "/account/deposits/", text: `${refundable} deposit${refundable === 1 ? "" : "s"} to refund` } : null,
  ].filter((item): item is { href: string; text: string } => item != null) : [];
  return (
    <Panel padding="content">
      <ModuleHeader title="My to-do" />
      {error ? <p className="text-sm text-mute">Could not read {chain.name}.</p>
        : !snapshot ? <p className="text-sm text-mute" role="status">Reading your votes…</p>
        : items.length === 0 ? <div className="flex flex-col items-start gap-3"><p className="text-sm text-mute">Nothing to do right now.</p><ArrowLink href={chainHref("/referenda/", { status: "deciding" })}>Browse deciding referenda</ArrowLink></div>
        : (
          <ul className="flex flex-col gap-2 text-sm">
            {items.map((item) => <li key={item.text}><ArrowLink href={chainHref(item.href)}>{item.text}</ArrowLink></li>)}
          </ul>
        )}
    </Panel>
  );
}
