import { parseChainParam } from "@/lib/chain-query";
import { chainCookie, chains } from "@/lib/chains";
import type { ChainId } from "@/lib/types";
import { cookies } from "next/headers";

/** Reads chain from ?chain= (via middleware-synced cookie) or an explicit search param. */
export async function activeNetwork(chainParam?: string | null): Promise<ChainId> {
  if (chainParam) return parseChainParam(chainParam);
  const value = (await cookies()).get(chainCookie)?.value;
  return parseChainParam(value);
}

export async function activeChainLabel() {
  const network = await activeNetwork();
  return chains.find((c) => c.id === network)?.name ?? "Polkadot";
}
