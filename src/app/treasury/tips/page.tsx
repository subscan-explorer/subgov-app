import { listPage } from "@/lib/list-page";
import type { Metadata } from "next";
import { TreasuryLegacyList } from "@/components/treasury-legacy-list";
import { activeNetwork } from "@/lib/network-server";

export const metadata: Metadata = { title: "Tips" };

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string; page?: string }> }) {
  const query = await searchParams;
  const network = await activeNetwork(query.chain);
  return <TreasuryLegacyList kind="tips" network={network} page={listPage(query.page)} />;
}
