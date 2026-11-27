"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";
import { useChainHref } from "@/hooks/use-chain-href";
import { isLikelySs58Address } from "@/lib/address";

/** Directory-scoped lookup: a full address opens the profile, anything else searches identities. */
export function DelegateLookupForm({ defaultQuery = "" }: { defaultQuery?: string }) {
  const [q, setQ] = useState(defaultQuery);
  const router = useRouter();
  const chainHref = useChainHref();

  return (
    <form
      role="search"
      className="flex w-full min-w-0 items-center gap-2 sm:w-auto"
      onSubmit={(e) => {
        e.preventDefault();
        const query = q.trim();
        if (!query) return;
        if (isLikelySs58Address(query)) {
          router.push(chainHref(`/delegation/${encodeURIComponent(query)}/`));
          return;
        }
        router.push(chainHref("/delegation/", { q: query }));
      }}
    >
      <label htmlFor="delegate-query" className="sr-only">Find a delegate by address or identity</label>
      <div className="relative min-w-0 flex-1 sm:w-80 sm:flex-none">
        <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-mute" />
        <Input
          id="delegate-query"
          name="delegate-query"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          placeholder="Address or identity name"
          title="Paste a full SS58 address to open a profile, or search by on-chain identity name"
          className="!rounded-full !pl-10"
        />
      </div>
      <Button type="submit" variant="line" className="shrink-0">Find</Button>
    </form>
  );
}
