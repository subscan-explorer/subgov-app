import { activeNetwork } from "@/lib/network-server";
import { governanceRequest, subscan, subscanApi, SUBSCAN_PAGE_SIZE, type SubscanNetwork, type SubscanUpstream } from "@/lib/pubfi";
import { accountProfileIdentity } from "@/lib/account-profile";

type Envelope<T> = { code?: number; message?: string; data?: T };
export type PeopleRow = Record<string, unknown>;

const net = (network?: SubscanNetwork) => network ?? activeNetwork();
const source = (network: SubscanNetwork): SubscanUpstream =>
  network === "polkadot" ? "people-polkadot" : network === "kusama" ? "people-kusama" : network;

export const supportsPeople = (network: SubscanNetwork) => network !== "paseo";

const unwrap = <T>(response: Envelope<T>) => {
  if (response.code !== undefined && response.code !== 0) throw new Error(response.message || "Subscan request failed");
  return response.data;
};

const list = (data: unknown): PeopleRow[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const value = data as Record<string, unknown>;
    for (const key of ["list", "identity", "history"]) if (Array.isArray(value[key])) return value[key] as PeopleRow[];
  }
  return [];
};

export const peopleLive = {
  accountIdentity: async (address: string, network?: SubscanNetwork) => {
    const data = unwrap(await governanceRequest<Envelope<{ account?: { account_display?: { display?: string; identity?: boolean; people?: { display?: string } } } }>>(
      await net(network), "v2/scan/search", { key: address },
    ));
    return accountProfileIdentity(data?.account);
  },
  roleStatistics: async (network?: SubscanNetwork) => {
    const data = unwrap(await subscan<Envelope<unknown>>(source(await net(network)), "scan/accounts/statistics", {}));
    return list(data);
  },
  searchIdentity: async (query: string, network?: SubscanNetwork) => {
    const data = unwrap(await subscan<Envelope<{ identity?: PeopleRow[] }>>(source(await net(network)), "scan/search/identity", { identity: query, page: 0, row: SUBSCAN_PAGE_SIZE }));
    return list(data?.identity ? { identity: data.identity } : data);
  },
  accountTokens: async (address: string, network?: SubscanNetwork) => {
    const data = unwrap(await subscanApi.accountTokens(await net(network), address) as Envelope<unknown>);
    return list(data);
  },
  accountReferenda: async (address: string, network?: SubscanNetwork) => {
    const data = unwrap(await governanceRequest<Envelope<unknown>>(await net(network), "scan/account/referendum", { account: address, page: 0, row: SUBSCAN_PAGE_SIZE }));
    const rows = list(data);
    const count = Number((data as { count?: unknown } | undefined)?.count);
    return { rows, count: Number.isFinite(count) ? count : rows.length };
  },
  balanceHistory: async (address: string, network?: SubscanNetwork) => {
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const data = unwrap(await governanceRequest<Envelope<{ history?: PeopleRow[] }>>(await net(network), "scan/account/balance_history", {
      address,
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    }));
    return list(data?.history ? { history: data.history } : data);
  },
};

export const identityDisplay = (row: PeopleRow) => {
  const id = row.identifier as Record<string, unknown> | undefined;
  const people = id?.people as Record<string, unknown> | undefined;
  return String(people?.display ?? id?.display ?? id?.address ?? row.address ?? "—");
};

export const identityAddress = (row: PeopleRow) => {
  const id = row.identifier as Record<string, unknown> | undefined;
  return String(id?.address ?? row.address ?? "");
};
