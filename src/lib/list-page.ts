/** URL pages are one based; provider offsets are zero based integers. */
export function listPage(value?: string): number {
  if (value != null && !/^\d+$/.test(value)) return 0;
  const page = Number(value ?? "1");
  return Number.isSafeInteger(page) && page > 0 ? page - 1 : 0;
}
