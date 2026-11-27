"use client";

import { parseChainParam, withChain } from "@/lib/chain-query";
import { chains } from "@/lib/chains";
import { useSearchParams } from "next/navigation";
import { useCallback } from "react";

export function useChainFromUrl() {
  const searchParams = useSearchParams();
  return parseChainParam(searchParams.get("chain"));
}

export function useChainHref() {
  const chain = useChainFromUrl();
  return useCallback((href: string, extra?: Record<string, string | number | undefined>) => withChain(href, chain, extra), [chain]);
}

export function useChain() {
  const chain = useChainFromUrl();
  return chains.find((c) => c.id === chain) ?? chains[0];
}
