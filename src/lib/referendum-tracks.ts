import { parseDecisionCurve } from "@/lib/decision-curve";
import type { Track } from "@/lib/types";

/** Human label for an OpenGov origin such as `medium_spender`. */
export function formatOriginName(name?: string) {
  if (!name) return "Track";
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function tracksFromPayload(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === "object") {
    const value = data as Record<string, unknown>;
    if (Array.isArray(value.list)) return value.list as Record<string, unknown>[];
    return Object.entries(value)
      .filter(([key]) => /^\d+$/.test(key))
      .map(([key, row]) => ({ ...(row as Record<string, unknown>), id: Number(key) }));
  }
  return [];
}

/**
 * Turn a `scan/referenda/tracks` payload into UI tracks.
 * Subscan returns an object keyed by track id. Paseo Asset Hub uses that same shape.
 */
export function mapGovernanceTracks(data: unknown): Track[] {
  return tracksFromPayload(data).map((row) => {
    const minApprovalCurve = parseDecisionCurve(row.min_approval);
    const minSupportCurve = parseDecisionCurve(row.min_support);
    return {
      id: Number(row.id ?? row.track_id ?? 0),
      name: String(row.name ?? row.track_name ?? "track"),
      displayName: formatOriginName(String(row.name ?? row.track_name ?? "track")),
      description: String(row.description ?? "On-chain OpenGov track"),
      maxDeciding: Number(row.max_deciding ?? row.current_deciding ?? 0),
      decisionDeposit: String(row.decision_deposit ?? "0"),
      preparePeriod: String(row.prepare_period ?? "—"),
      decisionPeriod: String(row.decision_period ?? "—"),
      confirmPeriod: String(row.confirm_period ?? "—"),
      minEnactmentPeriod: String(row.min_enactment_period ?? "—"),
      minApproval: minApprovalCurve?.label ?? "—",
      minSupport: minSupportCurve?.label ?? "—",
      minApprovalCurve,
      minSupportCurve,
      activeCount: row.active_count == null ? null : Number(row.active_count),
      allCount: Number(row.all_count ?? 0),
    };
  });
}
