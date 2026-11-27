"use client";

import { useChain } from "@/hooks/use-chain-href";
import { referendumBlockExplorer } from "@/lib/chains";
import { cn } from "@/lib/utils";
import { ArrowLink } from "@/components/ui";

/** Subscan explorer routes, e.g. https://polkadot.subscan.io/bounty/70. */
type SubscanKind = "block" | "extrinsic" | "preimage" | "referenda_v2" | "bounty";

export function SubscanLink({
  kind,
  value,
  referendumBlockAt,
  children,
  className,
  variant = "inline",
}: {
  kind: SubscanKind;
  value: string | number;
  referendumBlockAt?: string;
  children?: React.ReactNode;
  className?: string;
  variant?: "inline" | "action";
}) {
  const chain = useChain();
  const explorer = kind === "block" && referendumBlockAt ? referendumBlockExplorer(chain, referendumBlockAt) : chain.subscanUrl;
  const href = `${explorer}/${kind}/${encodeURIComponent(String(value))}`;
  if (variant === "action") {
    return <ArrowLink href={href} external size="sm" className={className}>{children ?? String(value)}</ArrowLink>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn("inline-flex items-center gap-1 text-link hover:underline", className)}
      title="Open in Subscan"
    >
      {children ?? String(value)}
      <span aria-hidden="true">↗</span>
    </a>
  );
}
