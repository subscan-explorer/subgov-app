import type { SubscanNetwork, SubscanUpstream } from "./subscan-request";

export type SpendSource = "all" | "current" | "relay";
export const spendSource = (value?: string): SpendSource => value === "relay" || value === "current" ? value : "all";
export const relaySpendSource = (network: SubscanNetwork): "polkadot" | "kusama" | null =>
  network === "polkadot" || network === "assethub-polkadot" ? "polkadot"
    : network === "kusama" || network === "assethub-kusama" ? "kusama" : null;
export const isRelaySpend = (row: { sourceNetwork?: SubscanUpstream }) => row.sourceNetwork === "polkadot" || row.sourceNetwork === "kusama";

type IndexedSpend = { proposal_id?: number; id?: number };
type Page<T> = { rows: T[]; count: number };
type ReadPage<T> = (source: SubscanUpstream, page: number, row: number) => Promise<Page<T>>;

/**
 * Migrated spend IDs continue on Asset Hub. Read only the pages intersecting the requested
 * window, checking the boundary before concatenating the two descending ID ranges.
 * Overlapping ranges must be viewed separately until their record identities are reconciled.
 */
export async function spendHistoryPage<T extends IndexedSpend>(
  read: ReadPage<T>, current: SubscanUpstream, relay: SubscanUpstream | null,
  { page = 0, row = 20, source = "all" }: { page?: number; row?: number; source?: SpendSource } = {},
) {
  if (!Number.isSafeInteger(page) || page < 0 || !Number.isSafeInteger(row) || row < 1 || row > 20) throw new Error("Invalid spend page");
  const sources = source === "relay" ? (relay ? [relay] : []) : source === "current" || !relay ? [current] : [current, relay];
  const requests = new Map<string, Promise<Page<T & { sourceNetwork: SubscanUpstream }>>>();
  const load = (network: SubscanUpstream, p: number) => {
    const key = `${network}:${p}`;
    if (!requests.has(key)) requests.set(key, read(network, p, row).then((result) => {
      if (!Number.isSafeInteger(result.count) || result.count < 0 || result.rows.length !== Math.min(row, Math.max(0, result.count - p * row))) throw new Error("Incomplete treasury spend page");
      const ids = result.rows.map((item) => Number(item.proposal_id ?? item.id));
      if (ids.some((id, i) => !Number.isSafeInteger(id) || id < 0 || (i > 0 && id >= ids[i - 1]))) throw new Error("Unexpected treasury spend order");
      return { ...result, rows: result.rows.map((item) => ({ ...item, sourceNetwork: network })) };
    }));
    return requests.get(key)!;
  };
  const first = await Promise.all(sources.map((network) => load(network, 0)));
  if (first.length === 2 && first[0].count && first[1].count) {
    const tail = await load(current, Math.floor((first[0].count - 1) / row));
    const oldestCurrent = tail.rows.at(-1)!;
    const newestRelay = first[1].rows[0];
    if (tail.count !== first[0].count || Number(oldestCurrent.proposal_id ?? oldestCurrent.id) <= Number(newestRelay.proposal_id ?? newestRelay.id)) {
      throw new Error("Spend histories overlap or changed; select Asset Hub or Relay history");
    }
  }
  const count = first.reduce((total, item) => total + item.count, 0);
  const rows: (T & { sourceNetwork: SubscanUpstream })[] = [];
  let base = 0;
  for (let i = 0; i < sources.length; i++) {
    const start = Math.max(0, page * row - base);
    const end = Math.min(first[i].count, (page + 1) * row - base);
    if (start < end) {
      const pages = await Promise.all(Array.from({ length: Math.floor((end - 1) / row) - Math.floor(start / row) + 1 }, (_, n) => load(sources[i], Math.floor(start / row) + n)));
      if (pages.some((p) => p.count !== first[i].count)) throw new Error("Treasury spend count changed; retry the page");
      rows.push(...pages.flatMap((p) => p.rows).slice(start % row, start % row + end - start));
    }
    base += first[i].count;
  }
  return { rows, count, page, row };
}
