import { Markdown } from "@/components/gov";
import { Badge, ModuleHeader, Panel } from "@/components/ui";

/** Read-only proposal description supplied by the governance index. */
export function ReferendumPost({ content, sourceBadge, sourceUrl }: { content: string; sourceBadge?: string; sourceUrl?: string }) {
  return (
    <Panel padding="content">
      <ModuleHeader title="Proposal description" meta={sourceBadge ? <Badge>{sourceBadge}</Badge> : undefined} />
      {sourceUrl ? <a className="mb-4 inline-block text-sm text-link hover:underline" href={sourceUrl} target="_blank" rel="noreferrer">View on Subsquare ↗</a> : null}
      <Markdown text={content} />
    </Panel>
  );
}
