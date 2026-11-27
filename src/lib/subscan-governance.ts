import { activeNetwork } from "@/lib/network-server";
import { governanceRequest, SUBSCAN_PAGE_SIZE } from "@/lib/pubfi";
import type { ChainId } from "@/lib/types";

type Envelope<T> = { code?: number; message?: string; data?: T };
export type GovRow = Record<string, unknown>;
export type DelegateDirectoryItem = {
  address: string;
  display?: string;
  balance: string;
  locked: string;
  extrinsics: number;
  votingPower?: string;
  tracks?: string[];
};

const unwrap = <T>(response: Envelope<T>) => {
  if (response.code !== undefined && response.code !== 0) throw new Error(response.message || "Subscan request failed");
  return response.data;
};

const list = (data: unknown): GovRow[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const value = data as Record<string, unknown>;
    if (Array.isArray(value.list)) return value.list;
    if (Array.isArray(value.extrinsics)) return value.extrinsics;
  }
  return [];
};

export async function liveDelegates(network: ChainId, page = 0) {
  const data = unwrap(await governanceRequest<Envelope<{ count?: number; list?: GovRow[] }>>(
    network,
    "v2/scan/accounts",
    { page, row: SUBSCAN_PAGE_SIZE, filter: "convictionDelegate" },
  ));
  const rows = data?.list ?? [];
  return {
    count: data?.count ?? rows.length,
    rows: rows.flatMap((row): DelegateDirectoryItem[] => {
      const address = typeof row.address === "string" ? row.address : "";
      if (!address) return [];
      const accountDisplay = row.account_display as { people?: { display?: string; parent?: { display?: string } } } | undefined;
      return [{
        address,
        display: accountDisplay?.people?.display ?? accountDisplay?.people?.parent?.display,
        balance: String(row.balance ?? "0"),
        locked: String(row.balance_lock ?? row.lock ?? "0"),
        extrinsics: Number(row.count_extrinsic ?? 0),
        votingPower: row.delegated_voting_power != null ? String(row.delegated_voting_power) : row.voting_power != null ? String(row.voting_power) : undefined,
        tracks: Array.isArray(row.tracks) ? row.tracks.map(String) : undefined,
      }];
    }),
  };
}

export async function liveDelegate(address: string, network?: ChainId) {
  const net = network ?? await activeNetwork();
  const data = unwrap(await governanceRequest<Envelope<unknown>>(net, "scan/referenda/delegate", { account: address }));
  return (data && typeof data === "object" ? data : {}) as GovRow;
}

export async function liveDelegateSupporters(address: string, network?: ChainId) {
  const net = network ?? await activeNetwork();
  const data = unwrap(await governanceRequest<Envelope<unknown>>(net, "scan/referenda/delegates", {
    account: address, is_delegator: true, is_active: true, page: 0, row: SUBSCAN_PAGE_SIZE,
  }));
  return list(data);
}
