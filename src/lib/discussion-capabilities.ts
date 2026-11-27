import { discussionRequest } from "@/lib/discussion";

export type DegovCapabilities = { editComments: boolean };

/** Only expose comment editing when both update and delete mutations are available. */
export function capabilitiesFromSchema(mutations: readonly string[]): DegovCapabilities {
  return { editComments: ["updateDiscussionComment", "deleteDiscussionComment"].every((name) => mutations.includes(name)) };
}

const schemaQuery = `{ __schema { mutationType { fields { name } } } }`;
let cached: Promise<DegovCapabilities> | null = null;

/** Optional comment editing support; posting and replies do not depend on introspection. */
export function degovCapabilities(): Promise<DegovCapabilities> {
  cached ??= discussionRequest<{ __schema: { mutationType: { fields: { name: string }[] } | null } }>(schemaQuery, {})
    .then((data) => capabilitiesFromSchema(data.__schema.mutationType?.fields.map((field) => field.name) ?? []))
    .catch(() => {
      cached = null;
      return capabilitiesFromSchema([]);
    });
  return cached;
}
