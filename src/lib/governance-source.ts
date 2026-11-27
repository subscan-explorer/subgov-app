import type { ChainId } from "./types";

export type GovernanceKind = "referendums_v2" | "fellowship_referendums" | "treasury_spend";

/** Fixed, ecosystem-specific source links; never construct a URL from proposal content. */
export function subsquareUrl(chain: ChainId, kind: GovernanceKind, id: number): string | undefined {
  if (chain === "paseo" || !Number.isSafeInteger(id) || id < 0) return undefined;
  const host = kind === "fellowship_referendums" && chain === "polkadot" ? "collectives" : chain;
  const path = kind === "fellowship_referendums" ? "fellowship/referenda" : kind === "treasury_spend" ? "treasury/spends" : "referenda";
  return `https://${host}.subsquare.io/${path}/${id}`;
}
