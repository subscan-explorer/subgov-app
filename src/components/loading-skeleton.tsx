import { Panel } from "@/components/ui";

const bar = "rounded-full bg-panel-2";

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <Panel role="status" aria-label="Loading records" className="animate-pulse divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="record-row">
          <span className={`record-row-id h-5 w-12 ${bar}`} />
          <span className="record-row-body">
            <span className={`h-5 w-40 max-w-full ${bar}`} />
            <span className={`h-4 w-4/5 max-w-lg ${bar}`} />
            <span className={`h-3 w-1/3 max-w-xs ${bar}`} />
          </span>
          <span className={`record-row-value ml-auto h-8 w-16 ${bar}`} />
        </div>
      ))}
    </Panel>
  );
}

/**
 * Page header placeholder. The kicker (chain name) and back link are only
 * known once the page resolves, so they stay as bars; a known title renders as
 * text so the heading does not jump when data arrives.
 */
export function HeaderSkeleton({ title, description, back = false }: { title?: string; description?: string | null; back?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {back ? <div className={`h-4 w-28 animate-pulse ${bar}`} /> : null}
      <div className="flex flex-col">
        <div className={`mb-2.5 h-3 w-24 animate-pulse ${bar}`} />
        {title ? <h1 className="page-title text-paper">{title}</h1> : <div className={`h-9 w-80 max-w-full animate-pulse ${bar}`} />}
        {description === null ? null : description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-mute">{description}</p> : <div className={`mt-3 h-4 w-96 max-w-full animate-pulse ${bar}`} />}
      </div>
    </div>
  );
}

function StatSkeleton({ cells = 3 }: { cells?: number }) {
  return (
    <Panel className="stat-strip animate-pulse" style={{ "--stat-cols": cells } as React.CSSProperties}>
      {Array.from({ length: cells }).map((_, i) => (
        <div key={i} className="stat-cell">
          <div className={`h-3 w-20 max-w-full ${bar}`} />
          <div className={`mt-3 h-6 w-12 ${bar}`} />
        </div>
      ))}
    </Panel>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <HeaderSkeleton />
      <StatSkeleton />
      <ListSkeleton />
    </div>
  );
}

/** List route: known title, optional stat strip, rows. */
export function ListPageSkeleton({ title, description, back, stats, rows = 10 }: { title: string; description?: string | null; back?: boolean; stats?: number; rows?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <HeaderSkeleton title={title} description={description} back={back} />
      {stats ? <StatSkeleton cells={stats} /> : null}
      <ListSkeleton rows={rows} />
    </div>
  );
}

/** Detail route: back link, title, stat strip and the main + details columns. */
export function DetailSkeleton({ stats = 3 }: { stats?: number }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <HeaderSkeleton back />
      {stats ? <StatSkeleton cells={stats} /> : null}
      <div className="detail-layout animate-pulse" role="status" aria-label="Loading details">
        <div className="detail-side">
          <Panel padding="compact" className="flex flex-col gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className={`h-3 w-16 ${bar}`} />
                <div className={`h-4 w-40 max-w-full ${bar}`} />
              </div>
            ))}
          </Panel>
        </div>
        <div className="detail-main">
          <Panel padding="content" className="flex flex-col gap-3">
            <div className={`mb-2 h-5 w-32 ${bar}`} />
            {Array.from({ length: 7 }).map((_, i) => <div key={i} className={`h-4 ${i % 3 === 2 ? "w-2/3" : "w-full"} ${bar}`} />)}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/** Overview bento: same grid areas as the live page so nothing reflows. */
export function OverviewSkeleton() {
  const card = "ov-card min-h-[260px] gap-4";
  const lines = (n: number) => Array.from({ length: n }).map((_, i) => <div key={i} className={`h-4 ${i % 2 ? "w-3/4" : "w-full"} ${bar}`} />);
  return (
    <div className="ov" aria-busy="true">
      <div className="ov-head">
        <div className="ov-head-text">
          <h1 className="ov-title">Governance overview</h1>
          <div className={`mt-3 h-4 w-96 max-w-full animate-pulse ${bar}`} />
        </div>
      </div>
      <div className="ov-grid" role="status" aria-label="Loading overview">
        <div className={`${card} ov-hero`}><div className="flex animate-pulse flex-col gap-4"><div className={`h-3 w-24 ${bar}`} /><div className={`h-20 w-32 ${bar}`} />{lines(2)}</div></div>
        <div className={`${card} ov-approval`}><div className="flex animate-pulse flex-col gap-4"><div className={`h-3 w-28 ${bar}`} />{lines(5)}</div></div>
        <div className={`${card} ov-treasury`}><div className="flex animate-pulse flex-col gap-4"><div className={`h-3 w-20 ${bar}`} /><div className={`h-10 w-28 ${bar}`} />{lines(3)}</div></div>
        <div className={`${card} ov-status`}><div className="flex animate-pulse flex-col items-center gap-4"><div className={`h-3 w-20 self-start ${bar}`} /><div className="h-36 w-36 rounded-full border-[14px] border-panel-2" /></div></div>
        <div className={`${card} ov-latest`}><div className="flex animate-pulse flex-col gap-4"><div className={`h-3 w-28 ${bar}`} />{lines(6)}</div></div>
      </div>
    </div>
  );
}
