"use client";

import { AccountGate } from "@/components/account-gate";
import { AccountVotes } from "@/components/account-votes";

export default function Page() {
  return (
    <AccountGate title="My votes" active="/account/votes/">
      {({ account, chain }) => <AccountVotes chain={chain} address={account} canSign />}
    </AccountGate>
  );
}
