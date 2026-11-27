import { Badge, RecordRow, StatusBadge } from "@/components/ui";
import { SpendPaymentStatus } from "@/components/treasury-onchain";
import { withChain } from "@/lib/chain-query";
import type { SubscanNetwork } from "@/lib/pubfi";
import { rowAmountDisplay, rowStatus, rowTitle, type TreasuryRow } from "@/lib/subscan-treasury";
import type { ChainId } from "@/lib/types";
import { isRelaySpend } from "@/lib/treasury-history";
import { spendStatusLabel } from "@/lib/asset-kind";

function chainOf(network: SubscanNetwork | ChainId): ChainId {
  return network === "kusama" || network === "paseo" ? network : "polkadot";
}

export function SpendRow({ row, index, network }: { row: TreasuryRow; index: number; network: SubscanNetwork | ChainId }) {
  const id = row.id ?? row.proposal_id ?? index;
  return (
    <RecordRow
      href={withChain(`/treasury/spends/${id}/`, chainOf(network), { source: isRelaySpend(row) ? "relay" : "current" })}
      id={`#${id}`}
      badges={isRelaySpend(row) ? <><StatusBadge status={spendStatusLabel(null, rowStatus(row))} /><Badge>Relay history</Badge></> : <SpendPaymentStatus index={Number(id)} status={rowStatus(row)} />}
      title={rowTitle(row, `Treasury spend #${id}`)}
      valueLabel="Amount"
      value={rowAmountDisplay(row, network as SubscanNetwork)}
    />
  );
}

export function BountyRow({ row, index, network }: { row: TreasuryRow; index: number; network: SubscanNetwork | ChainId }) {
  const id = row.proposal_id ?? row.id ?? row.bounty_id ?? index;
  return (
    <RecordRow
      href={withChain(`/treasury/bounties/${id}/`, chainOf(network))}
      id={`#${id}`}
      badges={<StatusBadge status={rowStatus(row)} />}
      title={rowTitle(row, `Bounty #${id}`)}
      valueLabel="Value"
      value={rowAmountDisplay(row, network as SubscanNetwork)}
    />
  );
}
