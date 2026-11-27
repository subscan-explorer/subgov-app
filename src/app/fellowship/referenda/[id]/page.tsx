import type { Metadata } from "next";
import { DataNotice } from "@/components/data-notice";
import { TimelineItem, TimelineList } from "@/components/timeline";
import { Markdown } from "@/components/gov";
import { DetailLayout, MetaItem, MetaList, ModuleHeader, PageHeader, Panel, StatStrip, StatusBadge } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { chains } from "@/lib/chains";
import { formatDate, formatPlanck, shortAddr } from "@/lib/format";
import { activeNetwork } from "@/lib/network-server";
import { fellowshipExplorer, fellowshipLabel, fellowshipReferendum, fellowshipSource, fellowshipStatus, fellowshipTitle } from "@/lib/subscan-fellowship";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { liveGovernanceDescription } from "@/lib/subscan-data";
import { ReferendumPost } from "@/components/referendum-post";
import { subsquareUrl } from "@/lib/governance-source";

type Row = Record<string, unknown>;

/**
 * Ranked-collective tallies count rank-weighted votes (`pallet_ranked_collective` `Votes`, a plain integer),
 * not token balances, so they are shown as counts rather than formatted with the chain token.
 */
const weight = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : String(value);
};

/** Subscan returns decoded preimage arguments in `pre_image.params`, either as JSON or a JSON string. */
function decodedParams(value: unknown): string | null {
  if (value == null || value === "") return null;
  let parsed = value;
  if (typeof value === "string") {
    try { parsed = JSON.parse(value); } catch { return value; }
  }
  if (Array.isArray(parsed) && parsed.length === 0) return null;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length === 0) return null;
  return JSON.stringify(parsed, null, 2);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Fellowship referendum #${id}` };
}

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ chain?: string }> }) {
  const { id } = await params;
  const referendumId = Number(id);
  if (!Number.isSafeInteger(referendumId) || referendumId < 0) notFound();
  const network = await activeNetwork((await searchParams).chain);
  const chain = chains.find((item) => item.id === network) ?? chains[0];
  const supported = fellowshipSource(network) !== null;
  let referendum: Row | null | undefined;
  try { referendum = supported ? await fellowshipReferendum(referendumId, network) : undefined; } catch { referendum = null; }
  if (supported && referendum === undefined) notFound();
  const explorer = fellowshipExplorer(network);
  const account = referendum?.account && typeof referendum.account === "object" ? referendum.account as Row : undefined;
  const people = account?.people && typeof account.people === "object" ? account.people as Row : undefined;
  const proposer = account?.address ? String(account.address) : "";
  const preimage = referendum?.pre_image && typeof referendum.pre_image === "object" ? referendum.pre_image as Row : undefined;
  const timeline = Array.isArray(referendum?.timeline) ? referendum.timeline.filter((item): item is Row => Boolean(item && typeof item === "object")) : [];
  const callName = [referendum?.call_module ?? preimage?.call_module, referendum?.call_name ?? preimage?.call_name].filter(Boolean).map(String).join(".");
  const callArgs = decodedParams(preimage?.params);
  const block = Number(referendum?.created_block ?? 0);
  const createdAt = Number(referendum?.created_block_timestamp ?? 0);
  const source = fellowshipSource(network);
  const post = source && referendum ? await liveGovernanceDescription(referendumId, source, "fellowship_referendums").catch(() => null) : undefined;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        back={{ href: withChain("/fellowship/referenda/", network), label: "Fellowship referenda" }}
        kicker={`${chain.name} · Fellowship #${id}`}
        title={referendum ? fellowshipTitle(referendum, `Fellowship referendum #${id}`) : `Fellowship referendum #${id}`}
        description="Technical Fellowship referendum data indexed by Subscan."
      />
      {!supported ? <DataNotice kind="empty" title={`Fellowship is not available on ${chain.name}`}>This network does not expose the Technical Fellowship collective.</DataNotice>
        : referendum === null ? <DataNotice kind="error">Unable to load this Fellowship referendum from Subscan.</DataNotice>
        : referendum ? <>
          <div className="flex flex-wrap gap-2"><StatusBadge status={fellowshipStatus(referendum)} /></div>
          <StatStrip
            items={[
              { label: "Ayes", value: String(referendum.ayes_count ?? 0), hint: `${weight(referendum.ayes_amount)} rank-weighted votes` },
              { label: "Nays", value: String(referendum.nays_count ?? 0), hint: `${weight(referendum.nays_amount)} rank-weighted votes` },
              { label: "Abstains", value: String(referendum.abstains_count ?? 0) },
            ]}
          />
          <DetailLayout main={
            <div className="flex flex-col gap-5">
            <ReferendumPost content={post?.content || (post === null ? "The proposal description could not be loaded right now." : "No proposal description is available from Subscan.")}
              sourceBadge={post?.source ? `${post.source} · via Subscan` : undefined} sourceUrl={subsquareUrl(network, "fellowship_referendums", referendumId)} />
            {callName || preimage?.content || callArgs ? (
              <Panel padding="content">
                <ModuleHeader title="Proposal call" />
                {callName ? <p className="num mb-3 text-sm text-paper">{callName}</p> : null}
                {preimage?.content ? <Markdown text={String(preimage.content)} /> : null}
                {callArgs ? (
                  callArgs.length > 4000 ? (
                    <details>
                      <summary className="cursor-pointer text-sm text-link">Show decoded arguments</summary>
                      <pre className="num mt-3 whitespace-pre-wrap break-all rounded-lg bg-panel-2 p-3 text-xs">{callArgs}</pre>
                    </details>
                  ) : (
                    <pre className="num whitespace-pre-wrap break-all rounded-lg bg-panel-2 p-3 text-xs">{callArgs}</pre>
                  )
                ) : null}
                {!preimage?.content && !callArgs ? <p className="text-sm text-mute">Proposal arguments are not available for this referendum.</p> : null}
              </Panel>
            ) : null}
            <Panel padding="content">
              <ModuleHeader title="Timeline" />
              <TimelineList>
                {timeline.map((event, index) => {
                  const eventBlock = Number(event.block ?? 0);
                  const eventTime = Number(event.time ?? 0);
                  return <TimelineItem
                    key={`${String(event.status)}-${eventBlock}-${index}`}
                    title={String(event.status ?? "Update")}
                    date={eventTime > 0 ? formatDate(new Date(eventTime * 1000).toISOString()) : undefined}
                    block={eventBlock > 0 ? <a href={`${explorer}/block/${eventBlock}`} target="_blank" rel="noreferrer" className="text-link hover:underline">#{eventBlock} ↗</a> : <span className="text-mute">—</span>}
                  />;
                })}
              </TimelineList>
            </Panel>
            </div>
          } details={
            <Panel padding="compact">
              <ModuleHeader title="Details" />
              <MetaList>
              <MetaItem label="Origin" value={fellowshipLabel(referendum.origins) || `Track ${String(referendum.origins_id ?? "—")}`} />
              <MetaItem label="Call" value={callName || "—"} />
              <MetaItem label="Proposer" value={proposer ? <span className="inline-flex items-center gap-1"><Link href={withChain(`/user/${proposer}/`, network)} className="text-link hover:underline">{people?.display ? `${String(people.display)} · ${shortAddr(proposer)}` : <span className="num">{shortAddr(proposer)}</span>}</Link><CopyButton value={proposer} /></span> : "—"} />
              <MetaItem label="Submitted" value={createdAt > 0 ? formatDate(new Date(createdAt * 1000).toISOString()) : "—"} />
              <MetaItem label="Block" value={block > 0 ? <a href={`${explorer}/block/${block}`} target="_blank" rel="noreferrer" className="text-link hover:underline">#{block} ↗</a> : "—"} />
              <MetaItem label="Decision deposit" value={formatPlanck(referendum.decision_deposit_balance, chain.decimals, chain.symbol)} />
              <MetaItem label="Preimage" value={preimage?.hash ? <a href={`${explorer}/preimage/${String(preimage.hash)}`} target="_blank" rel="noreferrer" className="num text-link hover:underline">{shortAddr(String(preimage.hash), 7)} ↗</a> : "—"} />
              </MetaList>
            </Panel>
          } />
        </> : null}
    </div>
  );
}
