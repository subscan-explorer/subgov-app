import type { ChainId } from "@/lib/types";

export const discussionSpace = process.env.NEXT_PUBLIC_DEGOV_DISCUSSION_SPACE || "subgov";
export const discussionEndpoint = process.env.NEXT_PUBLIC_DEGOV_DISCUSSION_API || "https://api.degov.ai/graphql";

export type DiscussionKeyType = "sr25519" | "ed25519" | "ecdsa";
export function discussionKeyType(accountType?: DiscussionKeyType, fallback: DiscussionKeyType = "sr25519"): DiscussionKeyType {
  return accountType ?? fallback;
}

const chainPath: Record<ChainId, string> = {
  polkadot: "polkadot",
  kusama: "kusama",
  paseo: "paseo-asset-hub",
};

export type DiscussionTarget = {
  id: string;
  space: string;
  path: string;
  status: "ACTIVE" | "LOCKED";
};

export type DiscussionComment = {
  id: string;
  targetId: string;
  authorAddress: string;
  replyToId: string | null;
  body: string | null;
  state: "ACTIVE" | "DELETED";
  ctime: string;
  utime: string | null;
};

export type DiscussionPage = {
  items: DiscussionComment[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
};

export function referendumDiscussionPath(chainId: ChainId, referendumId: number) {
  return `/chains/${chainPath[chainId]}/referenda/${referendumId}`;
}

export async function discussionRequest<T>(
  query: string,
  variables: Record<string, unknown>,
  options: { endpoint?: string; token?: string; adminToken?: string; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(options.endpoint ?? discussionEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.adminToken ? { "X-Discussion-Admin-Token": options.adminToken } : {}),
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: options.signal,
  });
  const payload = await response.json().catch(() => null) as { data?: T; errors?: { message: string }[] } | null;
  if (!response.ok) throw new Error(`Discussion API returned ${response.status}`);
  if (payload?.errors?.length) throw new Error(payload.errors[0].message);
  if (!payload?.data) throw new Error("Discussion API returned no data");
  return payload.data;
}
