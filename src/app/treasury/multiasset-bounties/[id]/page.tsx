import type { Metadata } from "next";
import { MultiAssetBountyDetail } from "@/components/treasury-onchain";
import { PageHeader } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { activeNetwork } from "@/lib/network-server";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  return { title: `Multi-asset bounty #${(await params).id}` };
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ chain?: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const network = await activeNetwork((await searchParams).chain);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: withChain("/treasury/multiasset-bounties/", network), label: "Multi-asset bounties" }} kicker={`Multi-asset bounty #${id}`} title={`Multi-asset bounty #${id}`} />
      <MultiAssetBountyDetail id={Number(id)} />
    </div>
  );
}
