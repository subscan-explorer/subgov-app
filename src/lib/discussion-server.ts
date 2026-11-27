import "server-only";
import {
  discussionEndpoint,
  discussionRequest,
  discussionSpace,
  type DiscussionTarget,
} from "@/lib/discussion";

const targetQuery = `
  query DiscussionTarget($input: DiscussionTargetInput!) {
    discussionTarget(input: $input) { id space path status }
  }
`;

const registerMutation = `
  mutation RegisterDiscussionTarget($input: RegisterDiscussionTargetInput!) {
    registerDiscussionTarget(input: $input) { id space path status }
  }
`;

export async function ensureDiscussionTarget(path: string): Promise<DiscussionTarget> {
  const endpoint = process.env.DEGOV_DISCUSSION_API ?? discussionEndpoint;
  const existing = await discussionRequest<{ discussionTarget: DiscussionTarget | null }>(
    targetQuery,
    { input: { space: discussionSpace, path } },
    { endpoint, signal: AbortSignal.timeout(5_000) },
  );
  if (existing.discussionTarget) return existing.discussionTarget;

  const adminToken = process.env.DEGOV_DISCUSSION_ADMIN_TOKEN;
  if (!adminToken) throw new Error("Discussion provisioning is not configured");
  const registered = await discussionRequest<{ registerDiscussionTarget: DiscussionTarget }>(
    registerMutation,
    { input: { space: discussionSpace, path } },
    { endpoint, adminToken, signal: AbortSignal.timeout(5_000) },
  );
  return registered.registerDiscussionTarget;
}
