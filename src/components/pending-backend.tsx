import { DataNotice } from "@/components/data-notice";

/** Explains that a page waits on a Subscan/DeGov endpoint requested in a subgov issue. */
export function PendingBackend({ result, issue, what }: { result: { reason: "pending" | "error"; message: string }; issue: number; what: string }) {
  if (result.reason === "error") {
    return <DataNotice kind="error" title="Data unavailable">{what} could not be loaded right now ({result.message}).</DataNotice>;
  }
  return (
    <DataNotice kind="info" title="Waiting on the data service">
      {what} needs an index that is not deployed on this network yet (subgov #{issue}). This page fills in automatically once it is.
    </DataNotice>
  );
}

/** Horizontal bars for small categorical series. `value` 0–100 sets the bar width. */
export function BarList({ items }: { items: { label: React.ReactNode; value: number | null; detail?: React.ReactNode; tone?: "aye" | "nay" | "live" }[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={index} className="text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="num text-xs text-mute">{item.detail}</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-2" aria-hidden="true">
            <div className={item.tone === "nay" ? "h-full rounded-full bg-nay" : item.tone === "live" ? "h-full rounded-full bg-live" : "h-full rounded-full bg-aye"} style={{ width: `${Math.max(0, Math.min(100, item.value ?? 0))}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
