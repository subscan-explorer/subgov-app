import type { ReferendumStatus } from "@/lib/types";

const statusMap: Record<string, ReferendumStatus> = {
  submitted: "Preparing",
  decision: "Deciding",
  confirmstarted: "Confirming",
  confirm: "Confirming",
  confirmaborted: "Deciding",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  killed: "Killed",
  timeout: "TimedOut",
  timedout: "TimedOut",
  executed: "Executed",
  executedfailed: "ExecutedFailed",
};

/**
 * Map a Subscan referendum status onto the UI set.
 * `executedfailed` is a finished referendum whose call did not succeed.
 * An unrecognized status still falls back to Preparing.
 */
export function referendumStatus(raw?: string | null): ReferendumStatus {
  return statusMap[(raw ?? "").toLowerCase()] ?? "Preparing";
}
