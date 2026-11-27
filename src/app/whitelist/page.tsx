import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { WhitelistList } from "@/components/whitelist-list";
import { governanceChains } from "@/lib/chains";
import { activeNetwork } from "@/lib/network-server";

export const metadata: Metadata = { title: "Whitelisted calls" };

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const network = await activeNetwork((await searchParams).chain);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={governanceChains[network].name} title="Whitelisted calls"
        description="Call hashes the Technical Fellowship has whitelisted. A Whitelisted Caller referendum can dispatch them with root origin; each entry is removed once dispatched." />
      <WhitelistList />
    </div>
  );
}
