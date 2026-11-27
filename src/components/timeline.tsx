import type { ReactNode } from "react";

export function TimelineList({ children }: { children: ReactNode }) {
  return <ol className="subscan-timeline">{children}</ol>;
}

export function TimelineItem({
  title,
  date,
  block,
  detail,
}: {
  title: string;
  date?: string;
  block?: ReactNode;
  detail?: string;
}) {
  return (
    <li className="subscan-timeline-item">
      <span className="subscan-timeline-node" aria-hidden="true"><span /></span>
      <div className="subscan-timeline-content">
        <div className="subscan-timeline-head">
          <span className="subscan-timeline-title">{title}</span>
          {block ? <span className="subscan-timeline-block">{block}</span> : null}
        </div>
        {date ? <div className="subscan-timeline-date">{date}</div> : null}
        {detail ? <div className="subscan-timeline-detail">{detail}</div> : null}
      </div>
    </li>
  );
}
