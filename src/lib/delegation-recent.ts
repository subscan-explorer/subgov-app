import type { ChainId } from "@/lib/types";

export type RecentDelegate = { address: string; label?: string; at: number };

const KEY = "subgov-delegation-recent";
const MAX = 8;

function storageKey(chain: ChainId) {
  return `${KEY}:${chain}`;
}

export function getRecentDelegates(chain: ChainId): RecentDelegate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(chain));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentDelegate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecentDelegate(chain: ChainId, entry: { address: string; label?: string }) {
  if (typeof window === "undefined") return;
  const address = entry.address.trim();
  if (!address) return;
  const label = entry.label?.trim() || undefined;
  const now = Date.now();
  const next = [{ address, label, at: now }, ...getRecentDelegates(chain).filter((r) => r.address !== address)].slice(0, MAX);
  try {
    localStorage.setItem(storageKey(chain), JSON.stringify(next));
  } catch {
    /* ignore quota errors */
  }
}

export function clearRecentDelegates(chain: ChainId) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(chain));
  } catch {
    /* ignore */
  }
}
