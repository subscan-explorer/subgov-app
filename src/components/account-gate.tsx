"use client";

import { useApp } from "@/components/app-state";
import { DataNotice } from "@/components/data-notice";
import { Button, PageHeader } from "@/components/ui";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import type { ChainConfig } from "@/lib/chains";
import Link from "next/link";

const tabs = [
  { href: "/account/", label: "Overview" },
  { href: "/account/votes/", label: "Votes" },
  { href: "/account/deposits/", label: "Deposits" },
  { href: "/delegation/mine/", label: "Delegations" },
];

/** Account sub-navigation shared by the connected-account pages. */
export function AccountTabs({ active }: { active: string }) {
  const chainHref = useChainHref();
  return (
    <nav aria-label="Account sections" className="flex flex-wrap gap-2">
      {tabs.map((tab) => (
        <Link key={tab.href} href={chainHref(tab.href)} aria-current={tab.href === active ? "page" : undefined}
          className={tab.href === active ? "rounded-full bg-paper px-4 py-2 text-sm text-ink" : "rounded-full bg-panel px-4 py-2 text-sm text-mute hover:text-paper"}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** Renders `children` with the connected account, or a connect prompt. */
export function AccountGate({ title, active, children }: { title: string; active: string; children: (props: { account: string; chain: ChainConfig }) => React.ReactNode }) {
  const { account, openWalletDialog } = useApp();
  const chain = useChain();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={`${chain.name} · account`} title={title} />
      <AccountTabs active={active} />
      {account ? children({ account, chain }) : (
        <>
          <DataNotice kind="info" title="Connect your wallet">Connect an account to see its {title.toLowerCase()} on {chain.name}.</DataNotice>
          <Button className="w-fit" size="lg" onClick={() => openWalletDialog()}>Connect wallet</Button>
        </>
      )}
    </div>
  );
}
