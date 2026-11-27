import { chainCookie } from "@/lib/chains";
import type { ChainId } from "@/lib/types";

export const CHAIN_PARAM = "chain";

const VALID: ChainId[] = ["polkadot", "kusama", "paseo"];

export function parseChainParam(value?: string | null): ChainId {
  return isValidChain(value) ? value : "polkadot";
}

export function isValidChain(value?: string | null): value is ChainId {
  return value === "polkadot" || value === "kusama" || value === "paseo";
}

/** Append or replace ?chain= on an internal href, preserving other query keys. */
export function withChain(href: string, chain: ChainId, extra?: Record<string, string | number | undefined>) {
  const hashIdx = href.indexOf("#");
  const hash = hashIdx >= 0 ? href.slice(hashIdx) : "";
  const base = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
  const qIdx = base.indexOf("?");
  const path = qIdx >= 0 ? base.slice(0, qIdx) : base;
  const params = new URLSearchParams(qIdx >= 0 ? base.slice(qIdx + 1) : "");
  params.set(CHAIN_PARAM, chain);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) params.set(key, String(value));
    }
  }
  const qs = params.toString();
  return `${path}${qs ? `?${qs}` : ""}${hash}`;
}

export { chainCookie, VALID as VALID_CHAINS };
