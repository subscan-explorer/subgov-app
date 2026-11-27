import type { SearchHit } from "@/lib/gov-actions";

export type PaletteItem = Omit<SearchHit, "group"> & { group: SearchHit["group"] | "Jump to" | "Pages" };

const SS58 = /^[1-9A-HJ-NP-Za-km-z]{46,48}$/;

/** Instant results that need no request: record numbers, pasted addresses and page names (#118). */
export function localSearch(query: string, pages: { href: string; label: string; group: string }[]): PaletteItem[] {
  const value = query.trim().replace(/^#/, "");
  if (!value) return pages.slice(0, 8).map((page) => ({ group: "Pages", href: page.href, title: page.label, detail: page.group }));
  const items: PaletteItem[] = [];
  if (/^\d{1,7}$/.test(value)) {
    items.push(
      { group: "Jump to", href: `/referenda/${value}/`, title: `Referendum #${value}` },
      { group: "Jump to", href: `/fellowship/referenda/${value}/`, title: `Fellowship referendum #${value}` },
      { group: "Jump to", href: `/treasury/spends/${value}/`, title: `Treasury spend #${value}` },
      { group: "Jump to", href: `/treasury/bounties/${value}/`, title: `Bounty #${value}` },
    );
  }
  if (SS58.test(value)) {
    items.push(
      { group: "Jump to", href: `/user/${encodeURIComponent(value)}/`, title: "Account profile", detail: value },
      { group: "Jump to", href: `/delegation/${encodeURIComponent(value)}/`, title: "Delegate profile", detail: value },
    );
  }
  const lower = value.toLowerCase();
  for (const page of pages) {
    if (page.label.toLowerCase().includes(lower) || `${page.group} ${page.label}`.toLowerCase().includes(lower)) items.push({ group: "Pages", href: page.href, title: page.label, detail: page.group });
  }
  return items;
}
