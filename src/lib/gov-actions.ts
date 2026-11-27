"use server";

import type { DepositKind } from "@/lib/account-voting";
import { parseChainParam } from "@/lib/chain-query";
import { governanceRequest, SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import { liveReferendum } from "@/lib/subscan-data";
import { liveDelegateSupporters } from "@/lib/subscan-governance";
import type { ChainId } from "@/lib/types";

/** Server actions that let client pages (wallet-scoped views) read Subscan without exposing API keys. */

type Envelope<T> = { code?: number; message?: string; data?: T };

export type ReferendumBrief = { id: number; title: string; status: string; trackLabel: string };

/** Titles and statuses for referenda the connected account voted on; misses are left out. */
export async function referendumBriefs(chain: ChainId, ids: number[]): Promise<ReferendumBrief[]> {
  const network = parseChainParam(chain);
  const unique = [...new Set(ids.filter((id) => Number.isSafeInteger(id) && id >= 0))].slice(0, 60);
  const settled = await Promise.allSettled(unique.map((id) => liveReferendum(id, network)));
  return settled.flatMap((result) => result.status === "fulfilled" && result.value
    ? [{ id: result.value.id, title: result.value.title, status: result.value.status, trackLabel: result.value.trackLabel ?? "" }]
    : []);
}

export type DelegatorRow = { address: string; display?: string; trackId?: number; origin?: string; conviction?: string; amount: string; votes?: string };

/** Accounts delegating to `address` (Subscan `scan/referenda/delegates`). */
export async function receivedDelegations(chain: ChainId, address: string): Promise<{ rows: DelegatorRow[]; error?: string }> {
  try {
    const rows = await liveDelegateSupporters(address, parseChainParam(chain));
    return {
      rows: rows.flatMap((row): DelegatorRow[] => {
        const account = row.account as { address?: string; people?: { display?: string } } | string | undefined;
        const who = typeof account === "string" ? account : account?.address ?? (typeof row.delegator === "string" ? row.delegator : "");
        if (!who) return [];
        return [{
          address: who,
          display: typeof account === "object" ? account?.people?.display : undefined,
          trackId: row.origins_id != null ? Number(row.origins_id) : row.track_id != null ? Number(row.track_id) : undefined,
          origin: typeof row.origins === "string" ? row.origins : typeof row.origin === "string" ? row.origin : undefined,
          conviction: row.conviction != null ? String(row.conviction) : undefined,
          amount: String(row.amount ?? row.balance ?? "0"),
          votes: row.votes != null ? String(row.votes) : undefined,
        }];
      }),
    };
  } catch (error) {
    return { rows: [], error: error instanceof Error ? error.message : "Delegators could not be loaded" };
  }
}

export type DepositRow = {
  referendumId: number;
  origin?: string;
  status?: string;
  kind: DepositKind;
  amount: string;
  decimals?: number;
  symbol?: string;
  refundable: boolean;
  refunded: boolean;
};

export type DepositPage = { available: boolean; rows: DepositRow[]; count: number; pageSize: number };

/**
 * Referendum deposits placed by `address`, from `POST /api/scan/referenda/deposits` (subscan-explorer/subgov#90).
 * `available: false` means the endpoint is not deployed yet; callers fall back to on-chain lookups.
 */
export async function accountDeposits(chain: ChainId, address: string, page = 0): Promise<DepositPage> {
  const unavailable: DepositPage = { available: false, rows: [], count: 0, pageSize: SUBSCAN_PAGE_SIZE };
  try {
    const response = await governanceRequest<Envelope<{ list?: Record<string, unknown>[] | null; count?: number }>>(parseChainParam(chain), "scan/referenda/deposits", {
      account: address, page, row: SUBSCAN_PAGE_SIZE,
    });
    if (response.code !== undefined && response.code !== 0) return unavailable;
    const list = response.data?.list ?? [];
    return {
      available: true,
      pageSize: SUBSCAN_PAGE_SIZE,
      count: Number(response.data?.count ?? list.length),
      rows: list.map((row) => ({
        referendumId: Number(row.referendum_index),
        origin: typeof row.origin === "string" ? row.origin : undefined,
        status: typeof row.referendum_status === "string" ? row.referendum_status : undefined,
        kind: row.kind === "submission" ? "submission" : "decision",
        amount: String(row.amount ?? "0"),
        decimals: row.decimals != null ? Number(row.decimals) : undefined,
        symbol: typeof row.symbol === "string" ? row.symbol : undefined,
        refundable: row.refundable === true,
        refunded: row.refunded === true,
      })),
    };
  } catch {
    return unavailable;
  }
}

export type NestedVote = {
  address: string;
  display?: string;
  side: "Aye" | "Nay" | "Abstain";
  conviction?: string;
  votes: string;
  selfVotes?: string;
  delegatedVotes?: string;
  delegations: { address: string; display?: string; conviction?: string; amount: string; votes: string }[];
};

function sideOf(status: unknown): NestedVote["side"] {
  const value = String(status ?? "").toLowerCase();
  return value.startsWith("aye") ? "Aye" : value.startsWith("nay") ? "Nay" : "Abstain";
}

function who(value: unknown) {
  if (!value || typeof value !== "object") return { address: typeof value === "string" ? value : "" };
  const row = value as { address?: string; people?: { display?: string } };
  return { address: row.address ?? "", display: row.people?.display };
}

/** Direct votes with their delegations nested (`POST /api/scan/referenda/votes/nested`, subgov#94). */
export async function nestedVotes(chain: ChainId, referendumIndex: number): Promise<{ available: boolean; rows: NestedVote[]; count: number }> {
  try {
    const response = await governanceRequest<Envelope<{ list?: Record<string, unknown>[]; count?: number }>>(parseChainParam(chain), "scan/referenda/votes/nested", { referendum_index: referendumIndex, page: 0, row: SUBSCAN_PAGE_SIZE });
    if (response.code !== undefined && response.code !== 0) return { available: false, rows: [], count: 0 };
    const list = response.data?.list ?? [];
    return {
      available: true,
      count: Number(response.data?.count ?? list.length),
      rows: list.map((row) => ({
        ...who(row.account),
        side: sideOf(row.status),
        conviction: row.conviction != null ? String(row.conviction) : undefined,
        votes: String(row.votes ?? row.amount ?? "0"),
        selfVotes: row.self_votes != null ? String(row.self_votes) : undefined,
        delegatedVotes: row.delegated_votes != null ? String(row.delegated_votes) : undefined,
        delegations: (Array.isArray(row.delegations) ? row.delegations as Record<string, unknown>[] : []).map((item) => ({
          ...who(item.account),
          conviction: item.conviction != null ? String(item.conviction) : undefined,
          amount: String(item.amount ?? "0"),
          votes: String(item.votes ?? "0"),
        })),
      })),
    };
  } catch {
    return { available: false, rows: [], count: 0 };
  }
}

export type VoteStatistics = {
  byConviction: { conviction: string; aye: string; nay: string; abstain: string; accounts: number }[];
  directAccounts?: number;
  delegatedAccounts?: number;
};

/** Per-conviction totals (`POST /api/scan/referenda/votes/statistics`, subgov#94). */
export async function voteStatistics(chain: ChainId, referendumIndex: number): Promise<{ available: boolean; data: VoteStatistics | null }> {
  try {
    const response = await governanceRequest<Envelope<{ by_conviction?: Record<string, unknown>[]; direct_accounts?: number; delegated_accounts?: number }>>(parseChainParam(chain), "scan/referenda/votes/statistics", { referendum_index: referendumIndex });
    if ((response.code !== undefined && response.code !== 0) || !response.data) return { available: false, data: null };
    return {
      available: true,
      data: {
        byConviction: (response.data.by_conviction ?? []).map((row) => ({
          conviction: String(row.conviction ?? "None"),
          aye: String(row.aye_votes ?? "0"),
          nay: String(row.nay_votes ?? "0"),
          abstain: String(row.abstain_votes ?? "0"),
          accounts: Number(row.accounts ?? 0),
        })),
        directAccounts: response.data.direct_accounts,
        delegatedAccounts: response.data.delegated_accounts,
      },
    };
  } catch {
    return { available: false, data: null };
  }
}

export type VoterTag = { side: "Aye" | "Nay" | "Abstain" | "Split"; amount: string; conviction: string };

/** Current vote of each commenter on a referendum (`scan/referenda/votes` with `account`, #110). Missing voters are left out. */
export async function voterTags(chain: ChainId, referendumIndex: number, accounts: string[]): Promise<Record<string, VoterTag>> {
  const unique = [...new Set(accounts)].slice(0, 40);
  const network = parseChainParam(chain);
  const settled = await Promise.allSettled(unique.map(async (account) => {
    const response = await governanceRequest<Envelope<{ list?: Record<string, unknown>[] }>>(network, "scan/referenda/votes", { referendum_index: referendumIndex, account, page: 0, row: 10, valid: "valid" });
    const rows = response.code ? [] : response.data?.list ?? [];
    if (!rows.length) return null;
    const statuses = new Set(rows.map((row) => String(row.status ?? "")));
    const raw = rows[0];
    const status = String(raw.status ?? "");
    const side: VoterTag["side"] = statuses.size > 1 || /split/i.test(status) ? "Split" : /abstain/i.test(status) ? "Abstain" : /nay/i.test(status) ? "Nay" : "Aye";
    return [account, { side, amount: String(raw.amount ?? raw.votes ?? "0"), conviction: String(raw.conviction ?? "") }] as const;
  }));
  return Object.fromEntries(settled.flatMap((result) => (result.status === "fulfilled" && result.value ? [result.value] : [])));
}

/** On-chain identity display names for wallet accounts (#114); misses are left out. */
export async function accountIdentities(chain: ChainId, addresses: string[]): Promise<Record<string, string>> {
  const { peopleLive } = await import("@/lib/subscan-people");
  const network = parseChainParam(chain);
  const unique = [...new Set(addresses)].slice(0, 12);
  const settled = await Promise.allSettled(unique.map(async (address) => [address, await peopleLive.accountIdentity(address, network)] as const));
  return Object.fromEntries(settled.flatMap((result) => (result.status === "fulfilled" && result.value[1] ? [[result.value[0], result.value[1]]] : [])));
}

export type SearchHit = { group: "Referenda" | "Treasury spends" | "Bounties" | "Accounts"; href: string; title: string; detail?: string };

/**
 * ⌘K search (#118): `scan/governance/search` when deployed, otherwise identity search plus `v2/scan/search` for accounts.
 */
export async function governanceSearch(chain: ChainId, key: string): Promise<{ hits: SearchHit[]; titleSearch: boolean }> {
  const query = key.trim().slice(0, 100);
  if (query.length < 2) return { hits: [], titleSearch: false };
  const network = parseChainParam(chain);
  const { optionalGovernance, addressOf } = await import("@/lib/subscan-optional");
  type Row = Record<string, unknown>;
  const full = await optionalGovernance<{ referendum?: Row[]; treasury_spend?: Row[]; bounty?: Row[]; account?: Row[] }>(network, "scan/governance/search", { key: query, row: 5 });
  if (full.available) {
    const data = full.data;
    return {
      titleSearch: true,
      hits: [
        ...(data.referendum ?? []).map((row): SearchHit => ({ group: "Referenda", href: `/referenda/${row.referendum_index}/`, title: `#${row.referendum_index} ${String(row.title ?? "")}`.trim(), detail: [row.status, row.origin].filter(Boolean).join(" · ") })),
        ...(data.treasury_spend ?? []).map((row): SearchHit => ({ group: "Treasury spends", href: `/treasury/spends/${row.index}/`, title: `#${row.index} ${String(row.title ?? "")}`.trim(), detail: row.status ? String(row.status) : undefined })),
        ...(data.bounty ?? []).map((row): SearchHit => ({ group: "Bounties", href: `/treasury/bounties/${row.index}/`, title: `#${row.index} ${String(row.title ?? "")}`.trim() })),
        ...(data.account ?? []).flatMap((row): SearchHit[] => { const who = addressOf(row.address ?? row); return who ? [{ group: "Accounts", href: `/user/${encodeURIComponent(who.address)}/`, title: String(row.display ?? who.display ?? who.address), detail: who.address }] : []; }),
      ],
    };
  }
  const identities = await governanceRequest<Envelope<{ identity?: Row[] } | Row[]>>(network, "scan/search/identity", { identity: query, page: 0, row: 8 }).catch(() => null);
  const rows = identities && !identities.code ? (Array.isArray(identities.data) ? identities.data : identities.data?.identity ?? []) : [];
  const hits = rows.flatMap((row): SearchHit[] => {
    const id = row.identifier as Row | undefined;
    const people = id?.people as Row | undefined;
    const address = String(id?.address ?? row.address ?? "");
    if (!address) return [];
    return [{ group: "Accounts", href: `/user/${encodeURIComponent(address)}/`, title: String(people?.display ?? id?.display ?? address), detail: address }];
  });
  return { hits, titleSearch: false };
}
