"use client";

import { AccountGate } from "@/components/account-gate";
import { AccountDelegations } from "@/components/undelegate";
import { ArrowLink } from "@/components/ui";
import { useChainHref } from "@/hooks/use-chain-href";

export default function Page() {
  const chainHref = useChainHref();
  return (
    <AccountGate title="My delegations" active="/delegation/mine/">
      {() => (
        <>
          <AccountDelegations />
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <ArrowLink href={chainHref("/delegation/mine/received/")}>Delegations I receive</ArrowLink>
            <ArrowLink href={chainHref("/delegation/")}>Find a delegate</ArrowLink>
          </div>
        </>
      )}
    </AccountGate>
  );
}
