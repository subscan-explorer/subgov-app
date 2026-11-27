import { listPage } from "@/lib/list-page";
import type { Metadata } from "next";
import { AccountLink } from "@/components/account-link";
import { DataNotice } from "@/components/data-notice";
import { ListPagination } from "@/components/list-pagination";
import { PreimageDecode, UnnotePreimage } from "@/components/preimage-actions";
import { PendingBackend } from "@/components/pending-backend";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { governanceChains } from "@/lib/chains";
import { formatBaseUnits, shortAddr } from "@/lib/format";
import { activeNetwork } from "@/lib/network-server";
import { SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import { addressOf, listOf, optionalGovernance } from "@/lib/subscan-optional";

export const metadata: Metadata = { title: "Preimages" };

type PreimageRow = { hash?: string; len?: number; status?: string; author?: unknown; account?: unknown; amount?: string; deposit?: string; decimals?: number; symbol?: string; call_module?: string; call_name?: string; created_block?: number };

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string; page?: string; account?: string }> }) {
  const query = await searchParams;
  const network = await activeNetwork(query.chain);
  const chain = governanceChains[network];
  const page = listPage(query.page);
  const account = query.account?.trim() || undefined;
  const result = await optionalGovernance<{ list?: PreimageRow[]; count?: number }>(network, "scan/preimage/list", {
    page, row: SUBSCAN_PAGE_SIZE, ...(account ? { account } : {}),
  });
  const rows = result.available ? listOf<PreimageRow>(result.data) : [];
  const count = result.available ? Number(result.data.count ?? rows.length) : 0;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={chain.name} title={account ? `Preimages by ${shortAddr(account, 6)}` : "Preimages"} description="Calls noted on-chain for referenda to enact. Decode any of them; the account that noted a preimage can unnote it to get its deposit back." />
      {!result.available ? <PendingBackend result={result} issue={100} what="The preimage list" /> : rows.length === 0 ? <DataNotice kind="empty">No preimages on record.</DataNotice> : (
        <>
          <Panel className="divide-y divide-line">
            {rows.map((row, index) => {
              const author = addressOf(row.author ?? row.account);
              const deposit = row.deposit ?? row.amount;
              return (
                <div key={row.hash ?? index} className="flex flex-col gap-2 px-5 py-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="num font-semibold text-paper">{row.call_module && row.call_name ? `${row.call_module}.${row.call_name}` : "Unknown call"}</span>
                      {row.status ? <Badge>{row.status}</Badge> : null}
                    </div>
                    {row.hash ? <UnnotePreimage hash={row.hash} author={author?.address} /> : null}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute">
                    <span className="num break-all" title={row.hash}>{row.hash ? shortAddr(row.hash, 10) : "—"}</span>
                    {row.len != null ? <span>{Number(row.len).toLocaleString()} bytes</span> : null}
                    {author ? <span>by <AccountLink network={network} address={author.address} display={author.display} /></span> : null}
                    {deposit ? <span className="num">deposit {formatBaseUnits(String(deposit), row.decimals ?? chain.decimals) ?? deposit} {row.symbol ?? chain.symbol}</span> : null}
                    {row.created_block ? <span className="num">#{row.created_block.toLocaleString()}</span> : null}
                  </div>
                  {row.hash ? <PreimageDecode hash={row.hash} len={row.len != null ? Number(row.len) : undefined} /> : null}
                </div>
              );
            })}
          </Panel>
          <ListPagination path="/preimages/" network={network} page={page} totalPages={Math.max(1, Math.ceil(count / SUBSCAN_PAGE_SIZE))} extra={{ account }} />
        </>
      )}
    </div>
  );
}
