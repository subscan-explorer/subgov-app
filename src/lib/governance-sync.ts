/**
 * Lets a finalized (or in-block) governance transaction tell the open referendum
 * page to re-read the on-chain tally, without waiting for the Subscan cache.
 */
export type GovernanceChange = {
  reason: "vote" | "delegation" | "remove-vote";
  phase: "inBlock" | "finalized";
  referendumId?: number;
  trackId?: number;
  voter?: string;
  extrinsicIndex?: string;
};

const EVENT = "subgov:governance-changed";

export function notifyGovernanceChanged(change: GovernanceChange) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GovernanceChange>(EVENT, { detail: change }));
}

export function subscribeGovernanceChanged(handler: (change: GovernanceChange) => void) {
  if (typeof window === "undefined") return () => {};
  const listener = (event: Event) => handler((event as CustomEvent<GovernanceChange>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}
