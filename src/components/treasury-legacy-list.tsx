import { DataNotice } from "@/components/data-notice";
import { ListPagination } from "@/components/list-pagination";
import { PendingBackend } from "@/components/pending-backend";
import { PageHeader, Panel, RecordRow, StatusBadge } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { formatBaseUnits } from "@/lib/format";
import { SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import type { ChainId } from "@/lib/types";
import { listOf, optionalGovernance } from "@/lib/subscan-optional";
import { rowAddress, rowAmountDisplay, rowStatus, type TreasuryRow } from "@/lib/subscan-treasury";

type Kind = "proposals" | "tips" | "burns";

const CONFIG: Record<Kind, { path: string; title: string; description: string; issue: number; pendingOnCodeError?: boolean }> = {
  proposals: { path: "scan/treasury/proposals", title: "Treasury proposals", description: "Proposals from the pre-OpenGov treasury (Council era). Read-only history.", issue: 108 },
  tips: { path: "scan/treasury/tips", title: "Tips", description: "Tips from the pre-OpenGov tipping module. Read-only history.", issue: 108 },
  burns: { path: "scan/treasury/burns", title: "Burns", description: "Native tokens burned from the treasury at the end of each spend period (Treasury.Burnt).", issue: 108 },
};

const short = (address: string) => (address.length > 16 ? `${address.slice(0, 6)}…${address.slice(-6)}` : address);

/** Read-only legacy treasury lists (#108). The burns endpoint is new and may not be deployed yet. */
export async function TreasuryLegacyList({ kind, network, page }: { kind: Kind; network: ChainId; page: number }) {
  const config = CONFIG[kind];
  const chain = governanceChains[network];
  const relayTips = kind === "tips" && (network === "polkadot" || network === "kusama");
  const explorer = relayTips ? `https://${network}.subscan.io` : chain.subscanUrl;
  const sourceName = relayTips ? `${network === "polkadot" ? "Polkadot" : "Kusama"} Relay Chain` : chain.name;
  const result = await optionalGovernance<{ list?: TreasuryRow[]; count?: number; decimals?: number; symbol?: string }>(network, config.path, { page, row: SUBSCAN_PAGE_SIZE });
  const rows = result.available ? listOf<TreasuryRow>(result.data) : [];
  const totalPages = result.available ? Math.max(1, Math.ceil(Number(result.data.count ?? rows.length) / SUBSCAN_PAGE_SIZE)) : 1;
  const decimals = result.available ? result.data.decimals ?? chain.decimals : chain.decimals;
  const symbol = result.available ? result.data.symbol ?? chain.symbol : chain.symbol;
  const render = (row: TreasuryRow, index: number) => {
    if (kind === "proposals") {
      const id = row.proposal_id ?? row.id ?? index;
      const beneficiary = rowAddress(row, "beneficiary");
      return <RecordRow key={id} href={`${chain.subscanUrl}/treasury/${id}`} id={`#${id}`} badges={<StatusBadge status={rowStatus(row)} />}
        title={row.title || row.description || `Treasury proposal #${id}`} meta={beneficiary !== "—" ? `Beneficiary ${short(beneficiary)}` : undefined} valueLabel="Value" value={rowAmountDisplay(row, network)} />;
    }
    if (kind === "tips") {
      const hash = String(row.hash ?? row.tip_hash ?? index);
      const who = rowAddress(row, "beneficiary") !== "—" ? rowAddress(row, "beneficiary") : rowAddress(row, "who");
      const value = row.tip_value ?? row.median_value ?? row.value ?? row.amount;
      return <RecordRow key={hash} href={`${explorer}/treasury_tip/${hash}`} id={short(hash)} badges={<StatusBadge status={rowStatus(row)} />}
        title={String(row.reason ?? row.title ?? "Tip")} meta={who !== "—" ? `For ${short(who)}` : undefined} valueLabel="Tip" value={value ? `${formatBaseUnits(String(value), decimals) ?? value} ${symbol}` : "—"} />;
    }
    const event = row.event_index ? String(row.event_index) : undefined;
    const block = Number(row.block_num ?? 0);
    return <RecordRow key={event ?? index} href={block ? `${chain.subscanUrl}/block/${block}` : chain.subscanUrl} id={block ? `#${block.toLocaleString()}` : `${index + 1}`}
      title={row.block_timestamp ? `${new Date(Number(row.block_timestamp) * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC` : "Burn"} meta={event ? `Event ${event}` : undefined}
      valueLabel="Burned" value={row.amount ? `${formatBaseUnits(String(row.amount), decimals) ?? row.amount} ${symbol}` : "—"} />;
  };
  const path = `/treasury/${kind}/`;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={{ href: withChain("/treasury/", network), label: "Treasury" }} kicker={`${sourceName} · Treasury`} title={config.title} description={config.description} />
      {!result.available ? (
        kind === "burns" ? <PendingBackend result={result} issue={config.issue} what="Treasury burn history" /> : <DataNotice kind="error">{config.title} could not be loaded right now.</DataNotice>
      ) : rows.length === 0 ? <DataNotice kind="empty" title={`No ${kind}`}>No {config.title.toLowerCase()} are indexed for {sourceName}.</DataNotice> : (
        <>
          <Panel className="divide-y divide-line">{rows.map(render)}</Panel>
          <ListPagination path={path} network={network} page={page} totalPages={totalPages} />
        </>
      )}
    </div>
  );
}
