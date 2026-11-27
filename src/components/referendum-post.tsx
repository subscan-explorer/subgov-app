import { Markdown } from "@/components/gov";
import { ArrowLink, Badge, ModuleHeader, Panel } from "@/components/ui";

/** Read-only proposal description supplied by the governance index. */
export function ReferendumPost({ content, sourceBadge, sourceUrl }: { content: string; sourceBadge?: string; sourceUrl?: string }) {
  return (
    <Panel padding="content">
      <ModuleHeader title="Proposal description" meta={sourceBadge ? <Badge>{sourceBadge}</Badge> : undefined} />
      {sourceUrl ? <ArrowLink className="mb-4" href={sourceUrl} external size="sm">View on Subsquare</ArrowLink> : null}
      <Markdown text={content} />
    </Panel>
  );
}
