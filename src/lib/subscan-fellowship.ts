import { formatStatusLabel } from "@/lib/format";
import { activeNetwork } from "@/lib/network-server";
import { SUBSCAN_PAGE_SIZE, subscan, type SubscanNetwork, type SubscanUpstream } from "@/lib/pubfi";

type Envelope<T> = { code?: number; message?: string; data?: T };
export type FellowshipStats = Record<string, unknown>;
export type FellowshipRow = Record<string, unknown>;
export type FellowshipTrack = FellowshipRow & { id: number };

const unwrap = <T>(response: Envelope<T>) => {
  if (response.code !== undefined && response.code !== 0) throw new Error(response.message || "Subscan request failed");
  return response.data;
};

export function fellowshipSource(network: SubscanNetwork): SubscanUpstream | null {
  if (network === "paseo" || network === "statemint") return null;
  return network === "polkadot" ? "collectives-polkadot" : network;
}

export function fellowshipExplorer(network: SubscanNetwork) {
  return network === "polkadot" ? "https://collectives-polkadot.subscan.io" : "https://kusama.subscan.io";
}

export async function fellowshipStatistics(network?: SubscanNetwork): Promise<FellowshipStats | undefined> {
  const net = network ?? await activeNetwork();
  const source = fellowshipSource(net);
  if (!source) return undefined;
  const data = unwrap(await subscan<Envelope<FellowshipStats>>(source, "scan/fellowship/statistics", {}));
  return data && typeof data === "object" ? data : undefined;
}

export async function fellowshipReferendums(network?: SubscanNetwork, page = 0, track?: FellowshipTrack): Promise<{ rows: FellowshipRow[]; count: number }> {
  const net = network ?? await activeNetwork();
  const source = fellowshipSource(net);
  if (!source) return { rows: [], count: 0 };
  // The provider compares the exact name returned by tracks (which may be hex encoded).
  const origin = track ? String(track.name ?? track.track_name ?? "") : "";
  if (track && !origin) throw new Error("Selected Fellowship track is unavailable");
  const data = unwrap(await subscan<Envelope<{ list?: FellowshipRow[]; count?: number }>>(source, "scan/fellowship/referendums", { page, row: SUBSCAN_PAGE_SIZE, ...(origin ? { origin } : {}) }));
  const rows = Array.isArray(data?.list) ? data.list : [];
  if (track && rows.some((row) => row.origins_id == null || Number(row.origins_id) !== track.id)) {
    throw new Error("The provider did not apply the Fellowship track filter");
  }
  const count = Number(data?.count);
  return { rows, count: Number.isFinite(count) ? count : rows.length };
}

export async function fellowshipReferendum(id: number, network?: SubscanNetwork): Promise<FellowshipRow | undefined> {
  const net = network ?? await activeNetwork();
  const source = fellowshipSource(net);
  if (!source) return undefined;
  const data = unwrap(await subscan<Envelope<FellowshipRow>>(source, "scan/fellowship/referendum", { referendum_index: id }));
  return data && typeof data === "object" ? data : undefined;
}

export async function fellowshipTracks(network?: SubscanNetwork): Promise<FellowshipTrack[]> {
  const net = network ?? await activeNetwork();
  const source = fellowshipSource(net);
  if (!source) return [];
  const data = unwrap(await subscan<Envelope<unknown>>(source, "scan/fellowship/tracks", {}));
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  return Object.entries(data).flatMap(([id, value]) => {
    const trackId = Number(id);
    return Number.isSafeInteger(trackId) && value && typeof value === "object" && !Array.isArray(value)
      ? [{ ...(value as FellowshipRow), id: trackId }]
      : [];
  });
}

export const originRows = (stats: FellowshipStats) => {
  const origins = stats.origins ?? stats.Origins;
  return Array.isArray(origins) ? (origins as Record<string, unknown>[]) : [];
};

export const originLabel = (row: Record<string, unknown>, fallback: string) => {
  const value = String(row.Origins ?? row.origin ?? fallback);
  return fellowshipLabel(value) || fallback;
};

/** Decoded origin / track / rank name in sentence case ("retain_at_1dan" → "Retain at 1dan"). */
export const fellowshipLabel = (value: unknown) => {
  const text = decodeFellowshipText(value);
  return text ? formatStatusLabel(text) : "";
};

export const decodeFellowshipText = (value: unknown) => {
  const text = String(value ?? "");
  if (!/^0x(?:[0-9a-f]{2})+$/i.test(text)) return text;
  return (text.slice(2).match(/.{2}/g) ?? [])
    .map((byte) => String.fromCharCode(Number.parseInt(byte, 16)))
    .join("")
    .replaceAll("\0", "")
    .trim();
};

export const fellowshipId = (row: FellowshipRow) => Number(row.referendum_index ?? row.id ?? 0);
export const fellowshipTitle = (row: FellowshipRow, fallback: string) => String(row.title ?? fallback);
export const fellowshipStatus = (row: FellowshipRow) => String(row.status ?? "Unknown");
