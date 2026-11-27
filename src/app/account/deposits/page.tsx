"use client";

import { AccountGate } from "@/components/account-gate";
import { AccountDeposits } from "@/components/account-deposits";

export default function Page() {
  return (
    <AccountGate title="My deposits" active="/account/deposits/">
      {({ account, chain }) => <AccountDeposits key={`${chain.id}:${account}`} chain={chain} address={account} canSign />}
    </AccountGate>
  );
}
