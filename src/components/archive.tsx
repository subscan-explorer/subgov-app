import { Markdown } from "@/components/gov";
import { PageHeader, Panel, StatusBadge } from "@/components/ui";
import type { Motion } from "@/lib/types";
import Link from "next/link";

export function MotionList({
  kicker,
  title,
  description,
  items,
  hrefOf,
}: {
  kicker: string;
  title: string;
  description?: string;
  items: Motion[];
  hrefOf: (m: Motion) => string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={kicker} title={title} description={description} />
      <Panel className="divide-y divide-line">
        {items.map((m) => (
          <Link key={m.id} href={hrefOf(m)} className="flex items-start justify-between gap-4 px-4 py-4">
            <div className="min-w-0">
              <StatusBadge status={m.status} />
              <div className="mt-1 leading-snug">{m.title}</div>
            </div>
            <span className="shrink-0 text-sm leading-5 text-mute">{m.threshold}</span>
          </Link>
        ))}
      </Panel>
    </div>
  );
}

export function MotionDetail({ kicker, m }: { kicker: string; m: Motion }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={kicker} title={m.title} />
      <StatusBadge status={m.status} />
      <Panel padding="content">
        <Markdown text={m.content} />
        <p className="mt-3 text-sm text-mute">
          {m.ayes} aye / {m.nays} nay · {m.threshold}
        </p>
      </Panel>
    </div>
  );
}
