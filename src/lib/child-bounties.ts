/** Subscan's legacy child list encodes both IDs in `index`, e.g. "10-42". */
type Row = Record<string, unknown>;

/** The legacy indexer's `amount` comes from ChildBountyClaimed: it is the net payout, not the bounty value. */
export function childBountyPayout(row: Row): string | null {
  if (String(row.status || row.state).toLowerCase() !== "claimed") return null;
  return row.amount != null && /^\d+$/.test(String(row.amount)) ? String(row.amount) : null;
}

const id = (value: unknown): number | undefined => {
  if (value == null || !/^\d+$/.test(String(value))) return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : undefined;
};
export function childBountyIds(row: Row, fallbackParent?: number) {
  const compound = /^(\d+)-(\d+)$/.exec(String(row.index ?? ""));
  return {
    parent: id(row.parent_bounty_id ?? row.parent_id ?? row.bounties_id ?? row.parent_index) ?? (compound ? id(compound[1]) : fallbackParent),
    index: id(row.child_index ?? row.child_bounty_id ?? row.child_bounties_id) ?? (compound ? id(compound[2]) : id(row.index ?? row.id)),
  };
}

/** Search paginated history. Never report not-found when a lookup limit or an upstream failure interrupted it. */
export async function findChildBounty<T extends Row>(parent: number, index: number, pageSize: number, load: (page: number) => Promise<{ list?: T[] | null; count?: number }>, maxPages = 50): Promise<T | undefined> {
  for (let page = 0; page < maxPages; page++) {
    const data = await load(page);
    const rows = data.list ?? [];
    const found = rows.find((row) => {
      const ids = childBountyIds(row, parent);
      return ids.parent === parent && ids.index === index;
    });
    if (found) return found;
    if (!rows.length || (data.count != null ? (page + 1) * pageSize >= data.count : rows.length < pageSize)) return undefined;
  }
  throw new Error("This bounty has too much history to search in one request. Open its child-bounty record on Subscan.");
}
