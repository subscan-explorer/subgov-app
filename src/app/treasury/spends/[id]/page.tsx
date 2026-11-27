import type { Metadata } from "next";
import { SpendView } from "./view";
import { RecordUnavailable } from "@/components/record-unavailable";
import { withChain } from "@/lib/chain-query";
import { notFound } from "next/navigation";
import { activeNetwork } from "@/lib/network-server";
import { treasuryLive } from "@/lib/subscan-treasury";
import { hasSpendRecord } from "@/lib/treasury-record";
import { spendSource } from "@/lib/treasury-history";
import { liveGovernanceDescription } from "@/lib/subscan-data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  return { title: `Spend #${id}` };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chain?: string; source?: string }>;
}) {
  const { id } = await params;
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) notFound();
  const query = await searchParams;
  const network = await activeNetwork(query.chain);
  const spend = await treasuryLive.spend(Number(id), network, spendSource(query.source)).catch(() => "failed" as const);
  if (spend === "failed") {
    return <RecordUnavailable title={`Treasury spend #${id}`} back={{ href: withChain("/treasury/spends/", network), label: "Treasury spends" }} />;
  }
  if (!hasSpendRecord(spend)) notFound();
  const post = await liveGovernanceDescription(Number(id), spend.sourceNetwork, "treasury_spend").catch(() => null);
  return <SpendView spend={spend} network={network} post={post} />;
}
