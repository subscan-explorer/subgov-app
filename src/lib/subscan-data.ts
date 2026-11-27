import { liveGovernanceBlockSeconds } from "@/lib/governance-clock-server";
import { planckToToken } from "@/lib/format";
import { referendumStatus } from "@/lib/referendum-status";
import { readSubscanPage, referendaListQuery } from "@/lib/subscan-page";
import { isLiveReferendum, referendumDeadline } from "@/lib/referendum-deadline";
import { formatOriginName, mapGovernanceTracks } from "@/lib/referendum-tracks";
import { tokenForNetwork } from "@/lib/tokens";
import { activeNetwork } from "@/lib/network-server";
import { subscan, subscanApi, SUBSCAN_PAGE_SIZE, type SubscanNetwork } from "@/lib/pubfi";
import type { GovernanceKind } from "@/lib/governance-source";
import { governanceUpstream, type SubscanUpstream } from "@/lib/subscan-request";
import type { Referendum, TimelineEvent, Track, Vote, VoteSide } from "@/lib/types";
import { canBeSplitVote, markSplitVotes, votesInExtrinsic, type ExistingVote } from "@/lib/conviction-voting";
import { unstable_cache } from "next/cache";

type Wrap<T> = { code: number; message: string; data: T };
type Person = { address: string; people?: { display?: string } };
type RawTimeline = { block?: number; status?: string; time?: number };
type RawReferendum = {
  referendum_index: number;
  title?: string;
  status?: string;
  origins_id?: number;
  origins?: string;
  account?: Person;
  call_module?: string;
  call_name?: string;
  created_block?: number;
  created_block_timestamp?: number;
  ayes?: string;
  nays?: string;
  ayes_amount?: string;
  nays_amount?: string;
  abstains_amount?: string;
  support?: string;
  support_amount?: string;
  approval_rate?: string;
  deposit_balance?: string;
  decision_deposit_balance?: string;
  pre_image?: { hash?: string; call_module?: string; call_name?: string; content?: string };
  timeline?: RawTimeline[];
  treasury_spend_id?: number;
  treasury_spend_ids?: number[] | null;
  treasury_proposal_id?: number;
  content?: string;
  summary?: string;
  description?: string;
};
type RawVote = {
  account?: Person;
  delegate_account?: Person;
  status?: string;
  amount?: string;
  votes?: string;
  conviction?: string | number;
  voting_time?: number;
  extrinsic_index?: string;
  relay_chain?: number;
};
type RawGovernanceComment = {
  id?: string;
  address?: string;
  ethereum_address?: string;
  username?: string;
  content?: string;
  create_at?: string;
  source?: string;
  replies?: RawGovernanceComment[] | null;
};
type RawGovernancePost = {
  title?: string;
  content?: string;
  source?: string;
  comment_count?: number;
  comment?: RawGovernanceComment[] | null;
};

export type GovernanceComment = {
  id: string;
  address?: string;
  ethereumAddress?: string;
  username?: string;
  content: string;
  createdAt?: string;
  source?: string;
  replies: GovernanceComment[];
};

export type GovernancePost = {
  title?: string;
  content?: string;
  source?: string;
  commentCount: number;
  comments: GovernanceComment[];
};

const iso = (timestamp?: number) => (timestamp ? new Date(timestamp * 1000).toISOString() : new Date(0).toISOString());
const address = (person?: Person) => person?.address ?? "—";

function approvalFromAmounts(ayes?: string, nays?: string): number | null {
  if (!ayes || !nays) return null;
  try {
    const a = BigInt(ayes.replaceAll("_", ""));
    const n = BigInt(nays.replaceAll("_", ""));
    const total = a + n;
    if (total === BigInt(0)) return null;
    return Number((a * BigInt(10000)) / total) / 100;
  } catch {
    return null;
  }
}

function mapTimeline(raw: RawReferendum): TimelineEvent[] {
  if (raw.timeline?.length) {
    return raw.timeline.map((e, i) => ({
      id: `${e.status ?? "event"}-${e.block ?? i}`,
      title: e.status ?? "Event",
      at: iso(e.time),
      block: e.block ?? 0,
    }));
  }
  const created = iso(raw.created_block_timestamp);
  return [{ id: `submitted-${raw.referendum_index}`, title: "Submitted", at: created, block: raw.created_block ?? 0 }];
}

function resolveSpendId(raw: RawReferendum): number | undefined {
  if (raw.treasury_spend_id != null && raw.treasury_spend_id > 0) return raw.treasury_spend_id;
  const fromList = raw.treasury_spend_ids?.find((id) => id > 0);
  if (fromList) return fromList;
  if (raw.treasury_proposal_id != null && raw.treasury_proposal_id > 0) return raw.treasury_proposal_id;
  return undefined;
}

function mapVoteSide(status?: string): VoteSide {
  const s = (status ?? "").toLowerCase();
  if (s.startsWith("aye")) return "Aye";
  if (s.startsWith("nay")) return "Nay";
  return "Abstain";
}

function mapConviction(value?: string | number) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (n === 0) return "0.1x";
  if (Number.isFinite(n)) return `${n}x`;
  return String(value);
}

export function normalizeReferendum(raw: RawReferendum, network: SubscanNetwork): Referendum {
  const status = referendumStatus(raw.status);
  const created = iso(raw.created_block_timestamp);
  const decimals = tokenForNetwork(network).decimals;
  const hasDetailAmounts = raw.ayes_amount != null || raw.nays_amount != null;

  const aye = hasDetailAmounts
    ? planckToToken(raw.ayes_amount, decimals)
    : raw.ayes != null
      ? planckToToken(raw.ayes, decimals) ?? raw.ayes
      : null;
  const nay = hasDetailAmounts
    ? planckToToken(raw.nays_amount, decimals)
    : raw.nays != null
      ? planckToToken(raw.nays, decimals) ?? raw.nays
      : null;
  const abstain = raw.abstains_amount ? planckToToken(raw.abstains_amount, decimals) : null;
  const supportAmount = raw.support_amount ? planckToToken(raw.support_amount, decimals) : null;

  const approval =
    raw.approval_rate != null && raw.approval_rate !== ""
      ? Number(raw.approval_rate)
      : approvalFromAmounts(raw.ayes_amount, raw.nays_amount);

  const call =
    [raw.call_module, raw.call_name].filter(Boolean).join(".") ||
    [raw.pre_image?.call_module, raw.pre_image?.call_name].filter(Boolean).join(".") ||
    "—";

  const content =
    raw.content ||
    raw.pre_image?.content ||
    (raw.title ? `${raw.title}\n\nOn-chain referendum data supplied by Subscan.` : "On-chain referendum data supplied by Subscan.");

  return {
    id: raw.referendum_index,
    title: raw.title || `Referendum #${raw.referendum_index}`,
    proposer: address(raw.account),
    proposerIdentity: raw.account?.people?.display,
    trackId: raw.origins_id ?? 0,
    trackLabel: formatOriginName(raw.origins) || `Track ${raw.origins_id ?? 0}`,
    status,
    hash: "",
    preimageHash: raw.pre_image?.hash ?? "",
    call,
    content,
    summary: [raw.summary, raw.description, raw.content]
      .map((value) => value?.trim())
      .find((value) => value && value !== raw.title?.trim()) ?? "",
    submittedAt: created,
    submittedBlock: raw.created_block ?? 0,
    aye,
    nay,
    abstain,
    support: null,
    supportAmount,
    approval: Number.isFinite(approval) ? approval : null,
    issuance: "0",
    decisionDeposit: planckToToken(raw.decision_deposit_balance, decimals) ?? "0",
    submissionDeposit: planckToToken(raw.deposit_balance, decimals) ?? "0",
    votes: [],
    timeline: mapTimeline(raw),
    comments: [],
    spendId: resolveSpendId(raw),
  };
}

export function normalizeVote(raw: RawVote): Vote {
  const side = mapVoteSide(raw.status);
  return {
    voter: address(raw.account),
    identity: raw.account?.people?.display ?? raw.delegate_account?.people?.display,
    side,
    amount: raw.amount ?? raw.votes ?? "0",
    // Abstain balance adds support only; Subscan still reports it at 0.1x, which reads as voting power.
    conviction: side === "Abstain" ? "—" : mapConviction(raw.conviction),
    at: iso(raw.voting_time),
    ...(raw.extrinsic_index ? { extrinsicIndex: raw.extrinsic_index } : {}),
    ...(raw.relay_chain ? { relayChain: true } : {}),
    ...(raw.delegate_account?.address ? { delegated: true } : {}),
  };
}

export async function liveReferendumVotes(
  referendumIndex: number,
  network?: SubscanNetwork,
  opts: { page?: number; row?: number } = {},
) {
  const net = network ?? (await activeNetwork());
  const page = opts.page ?? 0;
  const row = Math.min(opts.row ?? SUBSCAN_PAGE_SIZE, SUBSCAN_PAGE_SIZE);
  const response = (await subscanApi.votes(net, referendumIndex, { page, row, order: "desc" })) as Wrap<{ list?: RawVote[]; count?: number }>;
  if (response.code !== 0) throw new Error(response.message);
  const list = response.data?.list ?? [];
  return {
    network: net,
    page,
    row,
    count: response.data?.count ?? list.length,
    votes: list.map(normalizeVote),
  };
}

/** Fetches at most one batch of original calls for each chain represented on the displayed page. */
export async function enrichReferendumVotes(referendumIndex: number, network: SubscanNetwork, votes: Vote[]): Promise<Vote[]> {
  const upstream = governanceUpstream(network);
  const relay = upstream === "assethub-polkadot" || upstream === "statemint" ? "polkadot"
    : upstream === "assethub-kusama" ? "kusama" : upstream;
  const sourceFor = (vote: Vote) => vote.relayChain ? relay : upstream;
  const groups = new Map<SubscanUpstream, Set<string>>();
  for (const vote of votes) {
    const index = vote.extrinsicIndex;
    if (!index || !/^\d+-\d+$/.test(index) || vote.side === "Abstain" || !canBeSplitVote(vote)) continue;
    const source = sourceFor(vote);
    const indexes = groups.get(source) ?? new Set<string>();
    indexes.add(index);
    groups.set(source, indexes);
  }

  const batches = await Promise.all([...groups].map(async ([source, indexes]) => {
    const response = await subscanApi.extrinsicParams(source, [...indexes].sort()).catch(() => null);
    const ballots = new Map<string, ExistingVote[]>();
    if (response?.code === 0 && Array.isArray(response.data)) {
      for (const item of response.data) {
        if (item?.extrinsic_index && indexes.has(item.extrinsic_index)) {
          ballots.set(item.extrinsic_index, votesInExtrinsic(item.params, referendumIndex));
        }
      }
    }
    return [source, ballots] as const;
  }));
  const byChain = new Map(batches);
  return markSplitVotes(votes, (vote) => vote.extrinsicIndex
    ? byChain.get(sourceFor(vote))?.get(vote.extrinsicIndex)
    : undefined);
}

export async function liveReferenda(
  network?: SubscanNetwork,
  opts: { page?: number; row?: number; status?: string; origin?: string } = {},
) {
  const net = network ?? (await activeNetwork());
  const page = opts.page ?? 0;
  const row = Math.min(opts.row ?? SUBSCAN_PAGE_SIZE, SUBSCAN_PAGE_SIZE);
  const response = (await subscanApi.referenda(net, {
    page,
    row,
    ...referendaListQuery(opts.status),
    ...(opts.origin ? { origin: opts.origin } : {}),
  })) as Wrap<{ count?: number | null; list?: RawReferendum[] | null }>;
  if (response.code !== 0) throw new Error(response.message);
  if (!response.data) throw new Error("Subscan returned no referenda payload");
  const pageData = readSubscanPage(response.data);
  const rows = pageData.list.map((raw) => normalizeReferendum(raw, net));
  return { network: net, page, row, count: pageData.count, rows };
}

/**
 * OpenGov tracks for one network.
 * Paseo Asset Hub publishes the same track index as the other Asset Hubs.
 * Fellowship is a different collective and stays unavailable there.
 */
export async function liveTracks(network?: SubscanNetwork): Promise<Track[]> {
  const net = network ?? (await activeNetwork());
  const response = (await subscanApi.tracks(net)) as Wrap<unknown>;
  if (response.code !== 0) throw new Error(response.message);
  return mapGovernanceTracks(response.data);
}

/**
 * "Ends in …" labels for the deciding/confirming rows of a list page. The list endpoint has no timeline, so
 * each live row's detail payload is fetched; a failed lookup or unknown period simply leaves that row without
 * a countdown instead of guessing one.
 */
export async function liveReferendumDeadlines(rows: Referendum[], tracks: Track[], network?: SubscanNetwork) {
  const net = network ?? (await activeNetwork());
  const live = rows.filter(isLiveReferendum);
  if (!live.length) return new Map<number, string>();
  const [settled, secondsPerBlock] = await Promise.all([
    Promise.allSettled(live.map((row) => liveReferendum(row.id, net))),
    liveGovernanceBlockSeconds(net),
  ]);
  const deadlines = new Map<number, string>();
  const now = Date.now();
  settled.forEach((result, index) => {
    if (result.status !== "fulfilled" || !result.value) return;
    const detail = result.value;
    const label = referendumDeadline(detail, tracks.find((t) => t.id === detail.trackId), now, secondsPerBlock);
    if (label) deadlines.set(live[index].id, label);
  });
  return deadlines;
}

export async function liveReferendum(id: number, network?: SubscanNetwork) {
  const net = network ?? (await activeNetwork());
  const response = (await subscanApi.referendum(net, id)) as Wrap<RawReferendum>;
  if (response.code !== 0) throw new Error(response.message);
  return response.data ? normalizeReferendum(response.data, net) : undefined;
}

const cachedGovernancePost = unstable_cache(
  async (source: SubscanUpstream, id: number, kind: GovernanceKind): Promise<GovernancePost | undefined> => {
    const response = await subscan<Wrap<RawGovernancePost>>(source, "scan/governance/desc", { id: String(id), gov: kind });
    if (response.code !== 0) throw new Error(response.message);
    const raw = response.data;
    if (!raw) return undefined;
    const comments = (raw.comment ?? []).map(normalizeGovernanceComment);
    if (!raw.content && !comments.length) return undefined;
    return {
      title: raw.title,
      content: raw.content,
      source: raw.source,
      commentCount: raw.comment_count ?? comments.length,
      comments,
    };
  },
  ["subscan-governance-post-by-source"],
  { revalidate: 600 },
);

export async function liveGovernancePost(id: number, network?: SubscanNetwork) {
  return cachedGovernancePost(governanceUpstream(network ?? (await activeNetwork())), id, "referendums_v2");
}

export async function liveGovernanceDescription(id: number, source: SubscanUpstream, kind: GovernanceKind) {
  return cachedGovernancePost(source, id, kind);
}

function normalizeGovernanceComment(raw: RawGovernanceComment): GovernanceComment {
  return {
    id: raw.id ?? `${raw.address ?? raw.ethereum_address ?? "comment"}-${raw.create_at ?? "unknown"}`,
    address: raw.address,
    ethereumAddress: raw.ethereum_address,
    username: raw.username,
    content: raw.content ?? "",
    createdAt: raw.create_at,
    source: raw.source,
    replies: (raw.replies ?? []).map(normalizeGovernanceComment),
  };
}
