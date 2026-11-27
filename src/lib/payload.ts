/** Pure readers for loosely typed Subscan payloads. */

/** Reads `data.list` from a list payload. */
export function listOf<T = Record<string, unknown>>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  const value = data && typeof data === "object" ? (data as Record<string, unknown>).list : null;
  return Array.isArray(value) ? value as T[] : [];
}

export function addressOf(value: unknown): { address: string; display?: string } | null {
  if (typeof value === "string" && value) return { address: value };
  if (!value || typeof value !== "object") return null;
  const row = value as { address?: unknown; people?: { display?: unknown }; display?: unknown };
  if (typeof row.address !== "string" || !row.address) return null;
  const display = typeof row.people?.display === "string" ? row.people.display : typeof row.display === "string" ? row.display : undefined;
  return { address: row.address, display };
}

/** Ratio "0.64" → 64; null for missing values. */
export function ratioPercent(value: unknown): number | null {
  const n = Number(value);
  if (value == null || value === "" || !Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}
