"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Input, Select } from "@/components/ui";
import { useChainHref } from "@/hooks/use-chain-href";
import { cn } from "@/lib/utils";

type Filter = { key: string; label: string };

/**
 * Status chips, track filter and "Go to #" for the referenda list. Navigation runs in a transition so the
 * list dims while the next filter loads, and the active chip is scrolled into view on phones.
 */
export function ReferendaBrowser({
  path = "/referenda/",
  filters,
  status,
  tracks,
  track,
  children,
}: {
  path?: string;
  filters: Filter[];
  status: string;
  tracks: { id: number; label: string }[];
  track: number | null;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const chainHref = useChainHref();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<string | null>(null);
  const [jump, setJump] = useState("");
  const [jumpError, setJumpError] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rowRef.current?.querySelector<HTMLElement>("[aria-current='page']")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [status]);

  const go = (next: { status?: string; track?: number | null }) => {
    const nextStatus = next.status ?? status;
    const nextTrack = next.track === undefined ? track : next.track;
    setTarget(next.status ?? null);
    startTransition(() => {
      router.push(chainHref(path, {
        status: nextStatus === "all" ? undefined : nextStatus,
        track: nextTrack ?? undefined,
      }), { scroll: false });
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {filters.length ? <div ref={rowRef} role="group" aria-label="Filter by status" className="filter-row min-w-0 flex-1">
          {filters.map((f) => (
            <Button
              key={f.key}
              size="sm"
              variant={status === f.key ? "brass" : "ghost"}
              aria-current={status === f.key ? "page" : undefined}
              aria-busy={pending && target === f.key ? true : undefined}
              onClick={() => go({ status: f.key })}
            >
              {f.label}
            </Button>
          ))}
        </div> : null}
        {tracks.length ? (
          <label className="flex items-center gap-2 text-xs text-mute">
            <span className="sr-only sm:not-sr-only">Track</span>
            <Select
              aria-label="Filter by track"
              className="!h-9 w-auto !rounded-full !text-[13px]"
              value={track ?? ""}
              onChange={(event) => go({ track: event.target.value ? Number(event.target.value) : null })}
            >
              <option value="">All tracks</option>
              {tracks.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
          </label>
        ) : null}
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = jump.trim().replace(/^#/, "");
            if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
              setJumpError("Enter a referendum number, e.g. 1944");
              return;
            }
            setJumpError(null);
            startTransition(() => router.push(chainHref(`${path}${Number(value)}/`)));
          }}
        >
          <label htmlFor="referendum-jump" className="sr-only">Go to referendum number</label>
          <Input
            id="referendum-jump"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Go to #"
            value={jump}
            aria-invalid={jumpError ? true : undefined}
            aria-describedby={jumpError ? "referendum-jump-error" : undefined}
            className="!h-9 !w-28 !rounded-full !text-[13px]"
            onChange={(event) => { setJump(event.target.value); setJumpError(null); }}
          />
          <Button type="submit" size="sm" variant="line">Open</Button>
        </form>
      </div>
      {jumpError ? <p id="referendum-jump-error" className="-mt-2 text-xs text-nay" role="alert">{jumpError}</p> : null}
      <div aria-busy={pending || undefined} className={cn("transition-opacity duration-200", pending && "opacity-50")}>
        {children}
      </div>
    </div>
  );
}
