"use client";

import { useState, useTransition } from "react";
import { useChainHref } from "@/hooks/use-chain-href";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";

export function ReferendumJump() {
  const router = useRouter();
  const chainHref = useChainHref();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);
  return <form className="flex items-center gap-2" onSubmit={(event) => {
    event.preventDefault();
    const id = value.trim().replace(/^#/, "");
    if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) { setError(true); return; }
    setError(false);
    startTransition(() => router.push(chainHref(`/referenda/${Number(id)}/`)));
  }} aria-describedby={error ? "overview-referendum-jump-error" : undefined}>
    <label htmlFor="overview-referendum-jump" className="sr-only">Go to referendum number</label>
    <Input id="overview-referendum-jump" inputMode="numeric" placeholder="Go to #" value={value} aria-invalid={error || undefined} onChange={(event) => { setValue(event.target.value); setError(false); }} className="!h-9 !w-28 !rounded-full !text-[13px]" />
    <Button type="submit" size="sm" variant="line" disabled={pending}>Open</Button>
    {error ? <span id="overview-referendum-jump-error" className="sr-only">Enter a referendum number</span> : null}
  </form>;
}
