/** Heuristic for SS58 addresses (Polkadot/Kusama length range). */
export function isLikelySs58Address(value: string) {
  const t = value.trim();
  return t.length >= 46 && t.length <= 50 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(t);
}
