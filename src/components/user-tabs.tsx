"use client";

import { AccountDeposits } from "@/components/account-deposits";
import { AccountVotes } from "@/components/account-votes";
import { useApp } from "@/components/app-state";
import { ReceivedDelegations } from "@/components/received-delegations";
import { ModuleHeader, Panel } from "@/components/ui";
import { formatPlanck, useAccountDelegations } from "@/components/undelegate";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import { sameAccount } from "@/lib/account-chain";
import { shortAddr } from "@/lib/format";
import { convictionFromName } from "@/lib/vote";
import { USER_TABS, userTab, type UserTab } from "@/lib/user-tab";
import Link from "next/link";
import { useSearchParams } from "next/navigation";


/** Tab strip for `/user/[address]`; the active tab lives in `?tab=` so it can be linked. */
export function UserTabNav({ address }: { address: string }) {
  const chainHref = useChainHref();
  const active = userTab(useSearchParams().get("tab"));
  const labels: Record<UserTab, string> = { overview: "Overview", votes: "Votes", delegations: "Delegations", deposits: "Deposits" };
  return (
    <nav aria-label="Profile sections" className="flex flex-wrap gap-2">
      {USER_TABS.map((tab) => (
        <Link key={tab} scroll={false} href={chainHref(`/user/${encodeURIComponent(address)}/`, { tab: tab === "overview" ? undefined : tab })} aria-current={tab === active ? "page" : undefined}
          className={tab === active ? "rounded-full bg-paper px-4 py-2 text-sm text-ink" : "rounded-full bg-panel px-4 py-2 text-sm text-mute hover:text-paper"}>
          {labels[tab]}
        </Link>
      ))}
    </nav>
  );
}

function OutgoingDelegations({ address }: { address: string }) {
  const chain = useChain();
  const chainHref = useChainHref();
  const { delegations, error } = useAccountDelegations(chain, address);
  return (
    <Panel padding="content">
      <ModuleHeader title="Delegating to" meta="on-chain" />
      {error ? <p className="text-sm text-nay" role="alert">{error}</p>
        : delegations == null ? <p className="text-sm text-mute" role="status">Reading delegations…</p>
        : delegations.length === 0 ? <p className="text-sm text-mute">This address does not delegate any track.</p>
        : (
          <ul className="divide-y divide-line">
            {delegations.map((item) => (
              <li key={item.trackId} className="flex flex-wrap justify-between gap-3 py-3 text-sm">
                <span>{item.trackId} · {item.trackName}</span>
                <span className="num text-xs text-mute">{formatPlanck(item.balance, chain)} · {convictionFromName(item.conviction)} → <Link className="text-link" href={chainHref(`/delegation/${encodeURIComponent(item.target)}/`)}>{shortAddr(item.target, 6)}</Link></span>
              </li>
            ))}
          </ul>
        )}
    </Panel>
  );
}

/** Client sections of the public profile: votes, delegations and deposits read for any address. */
export function UserTabBody({ address }: { address: string }) {
  const chain = useChain();
  const { account } = useApp();
  const tab = userTab(useSearchParams().get("tab"));
  const own = Boolean(account && sameAccount(account, address));
  if (tab === "votes") return <AccountVotes chain={chain} address={address} canSign={own} />;
  if (tab === "delegations") return <div className="flex flex-col gap-6"><OutgoingDelegations address={address} /><ReceivedDelegations chain={chain} address={address} /></div>;
  // Anyone may submit a refund; the deposit always returns to the depositor.
  if (tab === "deposits") return <AccountDeposits key={`${chain.id}:${address}`} chain={chain} address={address} canSign />;
  return null;
}
