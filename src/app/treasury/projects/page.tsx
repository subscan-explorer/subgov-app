import { withChain } from "@/lib/chain-query";
import { activeNetwork } from "@/lib/network-server";
import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const network = await activeNetwork((await searchParams).chain);
  redirect(withChain("/treasury/bounties/", network));
}
