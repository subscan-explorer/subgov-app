import Link from "next/link";
import { withChain } from "@/lib/chain-query";
import { shortAddr } from "@/lib/format";
import type { ChainId } from "@/lib/types";

/** Server-safe address link to the public profile. */
export function AccountLink({ network, address, display, href }: { network: ChainId; address: string; display?: string; href?: string }) {
  return (
    <Link className="min-w-0 truncate text-link" href={href ?? withChain(`/user/${encodeURIComponent(address)}/`, network)} title={address}>
      {display ?? shortAddr(address, 6)}
    </Link>
  );
}
