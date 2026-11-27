/**
 * Measured seconds per block from Subscan `avgBlockTime`.
 *
 * The same metadata payload still reports a nominal `blockTime` of 6. That field
 * is the configured slot, not the observed production rate, so it must not be
 * passed here. A missing or non-positive value means the caller has no clock.
 */
export function blockSeconds(value: unknown): number | null {
  const text = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Elapsed timestamp time divided by the block clock actually used by governance. */
export function measuredClockSeconds(earlier: { timestampMs: number; block: number }, later: { timestampMs: number; block: number }): number | null {
  const elapsed = later.timestampMs - earlier.timestampMs;
  const blocks = later.block - earlier.block;
  if (![earlier.timestampMs, later.timestampMs, earlier.block, later.block].every(Number.isSafeInteger) || elapsed <= 0 || blocks <= 0) return null;
  return elapsed / 1000 / blocks;
}
