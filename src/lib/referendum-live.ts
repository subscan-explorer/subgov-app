import { parseReferendumOutcome } from "./account-voting";
import { formatBaseUnits } from "./format";
import { referendumStatus } from "./referendum-status";
import type { Referendum } from "./types";

export type LiveReferendumFields = Pick<Referendum, "status" | "submissionDeposit" | "decisionDeposit">;

/** Status and currently held deposits must come from the same storage snapshot. */
export function liveReferendumFields(json: unknown, decimals: number): LiveReferendumFields | null {
  const outcome = parseReferendumOutcome(json);
  if (outcome.state === "unknown") return null;
  const amount = (value: unknown) => formatBaseUnits(String(value ?? 0), decimals) ?? "0";
  if (outcome.state === "ongoing") {
    const ongoing = Object.values(json as Record<string, unknown>)[0] as {
      deciding?: { confirming?: number | null } | null;
      submissionDeposit?: { amount?: unknown } | null;
      decisionDeposit?: { amount?: unknown } | null;
    };
    if (!ongoing || typeof ongoing !== "object") return null;
    return {
      status: ongoing.deciding ? ongoing.deciding.confirming != null ? "Confirming" : "Deciding" : "Preparing",
      submissionDeposit: amount(ongoing.submissionDeposit?.amount),
      decisionDeposit: amount(ongoing.decisionDeposit?.amount),
    };
  }
  return {
    status: referendumStatus(outcome.state),
    submissionDeposit: amount("submissionDeposit" in outcome ? outcome.submissionDeposit?.amount : null),
    decisionDeposit: amount("decisionDeposit" in outcome ? outcome.decisionDeposit?.amount : null),
  };
}

export function withLiveReferendum(r: Referendum, fields?: LiveReferendumFields | null): Referendum {
  if (!fields) return r;
  // Referenda storage retains Approved after execution; the index supplies execution events.
  const executed = r.status === "Executed" || r.status === "ExecutedFailed";
  return { ...r, ...fields, status: fields.status === "Approved" && executed ? r.status : fields.status };
}
