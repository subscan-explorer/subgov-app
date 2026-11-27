import { activeNetwork } from "@/lib/network-server";
import { formatRowBalance, tokenFromRow } from "@/lib/tokens";
import { governanceRequest, subscan, SUBSCAN_PAGE_SIZE, type SubscanNetwork, type SubscanUpstream } from "@/lib/pubfi";
import { governanceUpstream } from "@/lib/subscan-request";
import { relaySpendSource, spendHistoryPage, type SpendSource } from "@/lib/treasury-history";
import { hasSpendRecord } from "@/lib/treasury-record";

const net = (network?: SubscanNetwork) => network ?? activeNetwork();

type Envelope<T> = { code?: number; message?: string; data?: T };

async function query<T>(network: SubscanNetwork, path: string, body: Record<string, unknown> = {}) {
  const response = await governanceRequest(network, path, { page: 0, row: SUBSCAN_PAGE_SIZE, ...body }) as Envelope<T>;
  if (response.code && response.code !== 0) throw new Error(response.message || "Subscan request failed");
  return response.data;
}

const list = <T>(data: unknown): T[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const value = data as Record<string, unknown>;
    for (const key of ["list", "proposals", "items", "results"]) if (Array.isArray(value[key])) return value[key] as T[];
  }
  return [];
};

const countOf = (data: unknown, rows: unknown[]) => {
  if (data && typeof data === "object" && "count" in data) {
    const n = Number((data as Record<string, unknown>).count);
    if (Number.isFinite(n)) return n;
  }
  return rows.length;
};

async function queryPage<T>(
  network: SubscanNetwork,
  path: string,
  opts: { page?: number; row?: number } & Record<string, unknown> = {},
) {
  const page = opts.page ?? 0;
  const row = Math.min(Number(opts.row ?? SUBSCAN_PAGE_SIZE), SUBSCAN_PAGE_SIZE);
  const data = await query<unknown>(network, path, { ...opts, page, row });
  const rows = list<T>(data);
  return { rows, count: countOf(data, rows), page, row };
}

/** Unwrap Subscan detail payloads (`{ info: … }`) or first list item. */
const one = <T>(data: unknown): T | undefined => {
  if (!data || typeof data !== "object") return undefined;
  const value = data as Record<string, unknown>;
  if (value.info && typeof value.info === "object") return value.info as T;
  const rows = list<T>(data);
  if (rows.length) return rows[0];
  return data as T;
};

export type TreasuryRow = Record<string, any> & { proposal_id?: number; id?: number; title?: string; sourceNetwork?: SubscanUpstream };

async function spendsPage(network: SubscanNetwork, opts: { page?: number; row?: number; source?: SpendSource } = {}) {
  return spendHistoryPage<TreasuryRow>(async (source, page, row) => {
    const response = await subscan<Envelope<unknown>>(source, "scan/treasury_spend/proposals", { page, row });
    if (response.code !== 0) throw new Error(response.message || "Subscan request failed");
    const rows = list<TreasuryRow>(response.data);
    const count = (response.data as { count?: number } | undefined)?.count;
    if (count == null) throw new Error("Treasury spend count unavailable");
    return { rows, count };
  }, governanceUpstream(network), relaySpendSource(network), opts);
}

async function spend(id: number, network: SubscanNetwork, source: SpendSource = "all") {
  const current = governanceUpstream(network);
  const relay = relaySpendSource(network);
  const sources = source === "relay" ? (relay ? [relay] : []) : source === "current" || !relay ? [current] : [current, relay];
  for (const sourceNetwork of sources) {
    const response = await subscan<Envelope<unknown>>(sourceNetwork, "scan/treasury_spend/proposal", { proposal_id: id });
    if (response.code === 10004) continue;
    if (response.code !== 0) throw new Error(response.message || "Subscan request failed");
    const result = one<TreasuryRow>(response.data);
    if (hasSpendRecord(result)) return { ...result, sourceNetwork };
  }
}

/**
 * Status filters accepted upstream. `scan/bounties/proposals` documents `active | historical`;
 * `scan/treasury_spend/proposals` accepts no status filter, so spends are not filterable server-side.
 */
export const BOUNTY_STATUS_FILTERS = ["active", "historical"] as const;
export type BountyStatusFilter = (typeof BOUNTY_STATUS_FILTERS)[number];
export const isBountyStatusFilter = (value?: string): value is BountyStatusFilter =>
  (BOUNTY_STATUS_FILTERS as readonly string[]).includes(value ?? "");

export const treasuryLive = {
  spendsPage: async (network?: SubscanNetwork, opts: { page?: number; row?: number; source?: SpendSource } = {}) =>
    spendsPage(await net(network), opts),
  spends: async (network?: SubscanNetwork) =>
    spendsPage(await net(network)).then((p) => p.rows),
  spendsCount: async (network?: SubscanNetwork) =>
    spendsPage(await net(network), { page: 0, row: 1 }).then((p) => p.count),
  spend: async (id: number, network?: SubscanNetwork, source?: SpendSource) =>
    spend(id, await net(network), source),
  /** `status` is the documented `scan/bounties/proposals` filter: "active" or "historical". */
  bountiesPage: async (network?: SubscanNetwork, opts: { page?: number; row?: number; status?: BountyStatusFilter } = {}) =>
    queryPage<TreasuryRow>(await net(network), "scan/bounties/proposals", opts),
  bounties: async (network?: SubscanNetwork) =>
    queryPage<TreasuryRow>(await net(network), "scan/bounties/proposals").then((p) => p.rows),
  bountiesCount: async (network?: SubscanNetwork) =>
    queryPage<TreasuryRow>(await net(network), "scan/bounties/proposals", { page: 0, row: 1 }).then((p) => p.count),
  bounty: async (id: number, network?: SubscanNetwork) =>
    query<unknown>(await net(network), "scan/bounties/proposal", { proposal_id: id }).then(one<TreasuryRow>),
};

export const rowTitle = (row: TreasuryRow, fallback: string) => row.title || row.description || row.name || fallback;
/** Raw base-unit amount from Subscan (prefer nested asset payload). */
export const rowAmount = (row: TreasuryRow) => tokenFromRow(row).amount;
/** Human-readable amount with correct token symbol and decimals. */
export const rowAmountDisplay = (row: TreasuryRow, network?: SubscanNetwork) => formatRowBalance(row, network);
export const rowStatus = (row: TreasuryRow) => String(row.status || row.state || "Unknown");
export const rowAddress = (row: TreasuryRow, key: string) => {
  const value = row[key];
  return typeof value === "string" ? value : value?.address || "—";
};
