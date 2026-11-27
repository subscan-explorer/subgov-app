"use client";

import { Modal } from "@/components/modal";
import { IconButton, Panel } from "@/components/ui";
import { useChain, useChainHref } from "@/hooks/use-chain-href";
import { governanceSearch } from "@/lib/gov-actions";
import { nav } from "@/lib/nav";
import { localSearch, type PaletteItem } from "@/lib/search-local";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const pages = nav.flatMap((group) => group.items.map((item) => ({ href: item.href, label: item.label, group: group.label })));

/** ⌘K / Ctrl+K command palette: record numbers, addresses, identities, titles (when the backend serves them) and pages (#118). */
export function SearchPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "/" && !open) {
        const target = event.target as HTMLElement | null;
        if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <IconButton type="button" variant="plain" className="shell-circle" aria-label="Search (⌘K)" title="Search (⌘K)" onClick={() => setOpen(true)}><Search size={18} /></IconButton>
      {open ? <PaletteDialog onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function PaletteDialog({ onClose }: { onClose: () => void }) {
  const chain = useChain();
  const chainHref = useChainHref();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<{ query: string; hits: PaletteItem[]; titleSearch: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => { input.current?.focus(); }, []);
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2 || /^#?\d+$/.test(value)) { setRemote(null); setLoading(false); return; }
    setLoading(true);
    const timer = window.setTimeout(() => {
      governanceSearch(chain.id, value).then((result) => setRemote({ query: value, ...result })).catch(() => setRemote({ query: value, hits: [], titleSearch: false })).finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [chain.id, query]);

  const items = useMemo(() => {
    const local = localSearch(query, pages);
    const hits = remote && remote.query === query.trim() ? remote.hits : [];
    const seen = new Set<string>();
    return [...local.filter((item) => item.group === "Jump to"), ...hits, ...local.filter((item) => item.group !== "Jump to")].filter((item) => !seen.has(item.href) && seen.add(item.href));
  }, [query, remote]);
  useEffect(() => { setActive(0); }, [items.length, query]);
  useEffect(() => { list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  const go = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    router.push(chainHref(item.href));
  };
  let lastGroup = "";
  return (
    <Modal titleId="search-title" onClose={onClose} className="max-w-xl self-start sm:mt-[12vh]">
      <Panel className="overflow-hidden bg-panel">
        <h2 id="search-title" className="sr-only">Search {chain.name}</h2>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search size={18} className="shrink-0 text-mute" aria-hidden="true" />
          <input ref={input} role="combobox" aria-expanded="true" aria-controls="search-results" aria-activedescendant={items[active] ? `search-item-${active}` : undefined}
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-paper outline-none placeholder:text-mute" placeholder="Referendum number, address, identity or page…"
            value={query} autoComplete="off" spellCheck={false}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(items.length - 1, value + 1)); }
              else if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); }
              else if (event.key === "Enter") { event.preventDefault(); go(items[active]); }
            }} />
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-mute sm:inline">Esc</kbd>
        </div>
        <ul id="search-results" ref={list} role="listbox" aria-label="Results" className="max-h-[50vh] overflow-y-auto py-2">
          {items.map((item, index) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <li key={`${item.group}-${item.href}`} role="presentation">
                {header ? <div className="px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-mute" role="presentation">{header}</div> : null}
                <div id={`search-item-${index}`} data-index={index} role="option" aria-selected={index === active}
                  className={`mx-2 flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${index === active ? "bg-panel-2 text-paper" : "text-paper/90"}`}
                  onMouseEnter={() => setActive(index)} onMouseDown={(event) => { event.preventDefault(); go(item); }}>
                  <span className="min-w-0 truncate">{item.title}</span>
                  {item.detail ? <span className="num max-w-[45%] shrink-0 truncate text-xs text-mute">{item.detail}</span> : null}
                </div>
              </li>
            );
          })}
          {!items.length ? <li className="px-4 py-6 text-center text-sm text-mute">{loading ? "Searching…" : "No matches."}</li> : null}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-2 text-[11px] text-mute">
          <span>↑↓ to move · Enter to open · Esc to close</span>
          <span>{loading ? "Searching…" : remote && !remote.titleSearch && query.trim().length >= 2 ? "Title search arrives with subgov#118" : "⌘K anywhere"}</span>
        </div>
      </Panel>
    </Modal>
  );
}
