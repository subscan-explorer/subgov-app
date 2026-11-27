/**
 * Read one Subscan list page.
 *
 * A filter that matches nothing still returns a numeric `count` with `list: null`.
 * That is an empty page. Mapping `list` directly throws and the caller treats a
 * real zero as a failed request.
 */
/**
 * Status body for `scan/referenda/referendums`.
 *
 * `active` is the open set on Subscan: submitted, decision, confirmStarted, and confirm.
 * Confirming is both confirm statuses; the UI shows each of those rows as Confirming.
 */
export function referendaListQuery(status?: string): { status?: string; multi_status?: string[] } {
  if (!status || status === "all") return {};
  if (status === "confirming") return { multi_status: ["confirmStarted", "confirm"] };
  const single: Record<string, string> = {
    active: "active",
    preparing: "submitted",
    deciding: "decision",
    executed: "executed",
    rejected: "rejected",
    cancelled: "cancelled",
    timedout: "timeout",
    killed: "killed",
    executedfailed: "executedFailed",
  };
  return { status: single[status] ?? status };
}

export function readSubscanPage<T>(data: { list?: T[] | null; count?: number | null } | null | undefined): { list: T[]; count: number } {
  const list = Array.isArray(data?.list) ? data.list : [];
  const count = Number(data?.count);
  return { list, count: Number.isFinite(count) ? count : list.length };
}
