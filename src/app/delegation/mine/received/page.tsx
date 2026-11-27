"use client";

import { AccountGate } from "@/components/account-gate";
import { ReceivedDelegations } from "@/components/received-delegations";

export default function Page() {
  return (
    <AccountGate title="Received delegations" active="/delegation/mine/">
      {({ account, chain }) => (
        <ReceivedDelegations chain={chain} address={account} />
      )}
    </AccountGate>
  );
}
