import { RecordRow, StatusBadge } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { childBountyIds, childBountyPayout } from "@/lib/child-bounties";
import type { SubscanNetwork } from "@/lib/pubfi";
import { rowAddress, rowAmountDisplay, rowStatus, rowTitle, type TreasuryRow } from "@/lib/subscan-treasury";
import type { ChainId } from "@/lib/types";

const chainOf = (network: SubscanNetwork | ChainId): ChainId => (network === "kusama" || network === "paseo" ? network : "polkadot");
const short = (address: string) => (address.length > 16 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address);

export const childParent = (row: TreasuryRow) => childBountyIds(row).parent;
export const childIndex = (row: TreasuryRow) => childBountyIds(row).index;

export function ChildBountyRow({ row, network, fallbackParent }: { row: TreasuryRow; network: SubscanNetwork | ChainId; fallbackParent?: number }) {
  const parent = childParent(row) ?? fallbackParent;
  const index = childIndex(row);
  const curator = rowAddress(row, "curator");
  const beneficiary = rowAddress(row, row.beneficiary ? "beneficiary" : "proposer");
  if (parent == null || index == null) return null;
  return (
    <RecordRow
      href={withChain(`/treasury/child-bounties/${parent}/${index}/`, chainOf(network))}
      id={`#${parent}-${index}`}
      badges={<StatusBadge status={rowStatus(row)} />}
      title={rowTitle(row, `Child bounty #${index} of bounty #${parent}`)}
      meta={[curator !== "—" ? `Curator ${short(curator)}` : null, beneficiary !== "—" ? `Beneficiary ${short(beneficiary)}` : null].filter(Boolean).join(" · ") || undefined}
      valueLabel="Beneficiary payout"
      value={childBountyPayout(row) != null ? rowAmountDisplay(row, network as SubscanNetwork) : "—"}
    />
  );
}
