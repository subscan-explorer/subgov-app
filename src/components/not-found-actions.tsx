"use client";

import { ButtonLink } from "@/components/ui";
import { useChainHref } from "@/hooks/use-chain-href";

/** Keeps the selected network when leaving the 404 page. */
export function NotFoundActions() {
  const chainHref = useChainHref();
  return (
    <div className="flex flex-wrap gap-2">
      <ButtonLink href={chainHref("/")}>Back to overview</ButtonLink>
      <ButtonLink href={chainHref("/referenda/")} variant="line">Browse referenda</ButtonLink>
    </div>
  );
}
