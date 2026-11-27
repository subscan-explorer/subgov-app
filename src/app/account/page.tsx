"use client";

import { useApp } from "@/components/app-state";
import { CopyButton } from "@/components/copy-button";
import { DataNotice } from "@/components/data-notice";
import { AccountDelegations } from "@/components/undelegate";
import { ArrowLink, Button, MetaItem, MetaList, ModuleHeader, PageHeader, Panel } from "@/components/ui";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import { AccountTabs } from "@/components/account-gate";

export default function Page() {
  const { account, identity, walletSource, openWalletDialog, readOnly } = useApp();
  const chain = useChain();
  const chainHref = useChainHref();
  if (!account) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader kicker={chain.name} title="Account" />
        <DataNotice kind="info" title="Connect your wallet">
          Choose a wallet and account to review it here before signing any governance action.
        </DataNotice>
        <Button className="w-fit" size="lg" onClick={() => openWalletDialog()}>Connect wallet</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={`${chain.name} · connected`} title={identity ?? "Account"} />
      <AccountTabs active="/account/" />
      <Panel padding="content" className="max-w-2xl">
        <ModuleHeader title={readOnly ? "Watch-only account" : "Signing account"} />
        <MetaList>
          <MetaItem label="Address" value={<span className="flex items-center gap-1.5"><span className="num break-all">{account}</span><CopyButton value={account} /></span>} />
          <MetaItem label="Display name" value={identity ?? "—"} />
          <MetaItem label="Wallet" value={walletSource ?? "—"} />
          <MetaItem label="Network" value={`${chain.name}${chain.testnet ? " · testnet" : ""}`} />
        </MetaList>
        <div className="mt-5 flex flex-wrap gap-3">
          <ArrowLink href={chainHref(`/user/${account}/`)}>Public profile and votes</ArrowLink>
          <ArrowLink href={`${chain.subscanUrl}/account/${account}`} external>View on Subscan</ArrowLink>
        </div>
      </Panel>
      <AccountDelegations />
    </div>
  );
}
