/** URL page numbers are one-based; return null for malformed requests. */
export function requestedVotesPage(value?: string): number | null {
  if (value == null) return 0;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page - 1 : null;
}

export function lastVotesPage(count: number, row: number): number {
  return Number.isFinite(count) && Number.isFinite(row) && row > 0
    ? Math.max(0, Math.ceil(count / row) - 1)
    : 0;
}
