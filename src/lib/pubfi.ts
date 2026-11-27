import "server-only";
import { unstable_cache } from "next/cache";
import { blockSeconds } from "@/lib/block-time";
import {
  governanceUpstream,
  resolveSubscanRequest,
  type SubscanNetwork,
  SubscanConfigError,
  subscanAuthHeaders,
  subscanSource,
  type SubscanSource,
  type SubscanUpstream,
} from "@/lib/subscan-request";

/** Server-side Subscan client. Keep API keys out of browser bundles. */
/** Keep list requests small for both providers. */
export const SUBSCAN_PAGE_SIZE = 20;

export type { SubscanNetwork, SubscanUpstream } from "@/lib/subscan-request";

export function clampPageSize(body?: Record<string, unknown>) {
  if (!body || typeof body.row !== "number") return body;
  return body.row > SUBSCAN_PAGE_SIZE ? { ...body, row: SUBSCAN_PAGE_SIZE } : body;
}

export class SubscanError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "SubscanError";
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseError(source: SubscanSource, status: number, payload: string) {
  const provider = source === "pubfi" ? "PubFi gateway" : source === "cluster" ? "Subscan cluster API" : "Subscan API";
  try {
    const json = JSON.parse(payload) as { message?: string; error?: { message?: string; code?: string } };
    const detail = json.message ?? json.error?.message ?? json.error?.code;
    if (status === 503) return detail ? `${provider} unavailable (${detail})` : `${provider} is temporarily unavailable. Try again shortly.`;
    if (status === 429) return `${provider} rate limit reached. Wait a moment and retry.`;
    return detail ? `${provider} request failed (${detail})` : `${provider} request failed (${status})`;
  } catch {
    return status === 503 ? `${provider} is temporarily unavailable. Try again shortly.` : `${provider} request failed (${status})`;
  }
}

const cachedRequest = unstable_cache(
  async (source: SubscanSource, upstream: string, bodyJson?: string, bestEffort = false): Promise<unknown> => {
    const headers = subscanAuthHeaders(source, process.env);
    let lastStatus = 0;
    let lastPayload = "";

    const attempts = bestEffort ? 1 : 3;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const response = await fetch(upstream, {
        method: bodyJson ? "POST" : "GET",
        headers: {
          ...headers,
          ...(bodyJson ? { "Content-Type": "application/json" } : {}),
        },
        body: bodyJson,
        signal: AbortSignal.timeout(bestEffort ? 4_000 : 15_000),
        cache: "no-store",
      });
      if (response.ok) return response.json();

      lastStatus = response.status;
      lastPayload = await response.text();
      if (![502, 503, 504].includes(response.status) || attempt === attempts - 1) break;
      await sleep(400 * (attempt + 1));
    }

    throw new SubscanError(lastStatus, parseError(source, lastStatus, lastPayload));
  },
  ["subscan-api"],
  { revalidate: 30 },
);

export async function subscan<T>(
  network: SubscanUpstream,
  path: string,
  body?: Record<string, unknown>,
  options: { bestEffort?: boolean } = {},
): Promise<T> {
  let source: SubscanSource;
  let request: ReturnType<typeof resolveSubscanRequest>;
  try {
    source = subscanSource(process.env);
    request = resolveSubscanRequest(source, network, path, process.env);
  } catch (error) {
    if (error instanceof SubscanConfigError) throw new SubscanError(0, error.message);
    throw error;
  }
  const bodyJson = body ? JSON.stringify(clampPageSize(body)) : undefined;
  return cachedRequest(source, request.url, bodyJson, options.bestEffort) as Promise<T>;
}

/** Query the selected ecosystem, preserving the relay source for legacy tips. */
export function governanceRequest<T = unknown>(network: SubscanNetwork, path: string, body?: Record<string, unknown>) {
  return subscan<T>(governanceUpstream(network, path), path, body);
}

/**
 * Observed seconds per block for one upstream (`avgBlockTime`).
 * A metadata miss returns null so callers omit the countdown instead of using the nominal 6s slot.
 */
export async function liveAvgBlockSeconds(upstream: SubscanUpstream): Promise<number | null> {
  try {
    const response = await subscan<{ code?: number; data?: { avgBlockTime?: unknown } }>(upstream, "scan/metadata", {});
    if (response.code !== undefined && response.code !== 0) return null;
    return blockSeconds(response.data?.avgBlockTime);
  } catch {
    return null;
  }
}

export const subscanApi = {
  now: (network: SubscanNetwork) => governanceRequest<Record<string, unknown>>(network, "now"),
  tracks: (network: SubscanNetwork) => governanceRequest(network, "scan/referenda/tracks", {}),
  referenda: (network: SubscanNetwork, body: { page?: number; row?: number; status?: string; multi_status?: string[]; origin?: string } = {}) =>
    governanceRequest(network, "scan/referenda/referendums", { page: 0, row: SUBSCAN_PAGE_SIZE, ...body }),
  referendum: (network: SubscanNetwork, referendum_index: number) =>
    governanceRequest(network, "scan/referenda/referendum", { referendum_index }),
  governanceDescription: (network: SubscanNetwork, id: number) =>
    governanceRequest(network, "scan/governance/desc", { id: String(id), gov: "referendums_v2" }),
  votes: (network: SubscanNetwork, referendum_index: number, body: { page?: number; row?: number; order?: string } = {}) =>
    // Subscan keeps every vote an account ever cast; only `valid` rows are the account's current vote.
    governanceRequest(network, "scan/referenda/votes", { referendum_index, page: 0, row: SUBSCAN_PAGE_SIZE, order: "desc", valid: "valid", ...body }),
  extrinsicParams: (network: SubscanUpstream, extrinsic_index: string[]) =>
    subscan<{ code: number; data?: { extrinsic_index?: string; params?: unknown }[] }>(
      network, "scan/extrinsic/params", { extrinsic_index }, { bestEffort: true },
    ),
  accountTokens: (network: SubscanNetwork, address: string) =>
    governanceRequest(network, "v2/scan/account/tokens", { address, page: 0, row: SUBSCAN_PAGE_SIZE, order: "desc", order_field: "balance" }),
  accountBalances: (network: SubscanNetwork, address: string) =>
    governanceRequest(network, "scan/account/balance_history", { address }),
};
