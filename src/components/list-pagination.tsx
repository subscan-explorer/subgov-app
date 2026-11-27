import Link from "next/link";
import { withChain } from "@/lib/chain-query";
import type { ChainId } from "@/lib/types";

/** 1 … 4 5 6 … 31 — first, last, and the neighbours of the current page. */
function pageItems(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    if (i && n - sorted[i - 1] > 1) items.push("gap");
    items.push(n);
  });
  return items;
}

export function ListPagination({
  path,
  network,
  page,
  totalPages,
  extra,
  compact = false,
  top = false,
}: {
  path: string;
  network: ChainId;
  page: number;
  totalPages: number;
  extra?: Record<string, string | number | undefined>;
  /** Top-of-list variant: page numbers only, no summary. */
  compact?: boolean;
  /** Distinguish a full top pagination landmark from its bottom counterpart. */
  top?: boolean;
}) {
  const currentPage = page + 1;
  if (totalPages <= 1) return null;
  const href = (n: number) => withChain(path, network, { ...extra, page: n > 1 ? n : undefined });
  return (
    <nav aria-label={top || compact ? "Pagination (top)" : "Pagination"} className="pager">
      {currentPage > 1 ? <Link className="pager-step" href={href(currentPage - 1)} aria-label="Previous page">←</Link> : <span className="pager-step is-disabled" aria-hidden="true">←</span>}
      <ol className="pager-pages">
        {pageItems(currentPage, totalPages).map((item, i) => item === "gap" ? (
          <li key={`gap-${i}`} className="pager-gap" aria-hidden="true">…</li>
        ) : (
          <li key={item}>
            <Link href={href(item)} className={`pager-page${item === currentPage ? " is-current" : ""}`} aria-current={item === currentPage ? "page" : undefined} aria-label={`Page ${item}`}>
              {item}
            </Link>
          </li>
        ))}
      </ol>
      {currentPage < totalPages ? <Link className="pager-step" href={href(currentPage + 1)} aria-label="Next page">→</Link> : <span className="pager-step is-disabled" aria-hidden="true">→</span>}
      {!compact ? <span className="pager-summary">Page {currentPage} of {totalPages.toLocaleString()}</span> : null}
    </nav>
  );
}
