import type { Metadata } from "next";
import { MultiAssetBountyList } from "@/components/treasury-onchain";
import { PageHeader } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { activeNetwork } from "@/lib/network-server";

export const metadata: Metadata = { title: "Multi-asset bounties" };

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const network = await activeNetwork((await searchParams).chain);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: withChain("/treasury/bounties/", network), label: "Bounties" }} kicker={`${governanceChains[network].name} · Treasury`} title="Multi-asset bounties"
        description="Bounties funded in USDT, USDC or another asset, read straight from the multiAssetBounties pallet." />
      <MultiAssetBountyList />
    </div>
  );
}
