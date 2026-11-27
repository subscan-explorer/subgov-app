import type { Referendum, Track } from "@/lib/types";

/** Statuses with a running decision or confirmation window. */
export const LIVE_REFERENDUM_STATUSES = ["Deciding", "Confirming"] as const;

export const isLiveReferendum = (r: Pick<Referendum, "status">) =>
  (LIVE_REFERENDUM_STATUSES as readonly string[]).includes(r.status);

/**
 * Track periods arrive as block counts or preformatted strings such as "28d".
 * A block count needs the chain's measured seconds per block. Without that rate
 * the duration is unknown — do not assume the nominal 6s slot.
 */
export function periodToMs(value: string, secondsPerBlock: number | null) {
  if (/^\d+$/.test(value)) {
    if (secondsPerBlock == null || !Number.isFinite(secondsPerBlock) || secondsPerBlock <= 0) return null;
    return Number(value) * secondsPerBlock * 1_000;
  }
  const units: Record<string, number> = { d: 86_400_000, h: 3_600_000, m: 60_000 };
  let total = 0;
  for (const [, amount, unit] of value.matchAll(/(\d+(?:\.\d+)?)\s*([dhm])/g)) total += Number(amount) * units[unit];
  return total || null;
}

export function formatDuration(ms: number) {
  const hours = ms / 3_600_000;
  if (hours >= 48) return `${Math.round(hours / 24)} days`;
  if (hours >= 1) return `${Math.round(hours)} h`;
  return `${Math.max(1, Math.round(ms / 60_000))} min`;
}

const eventTime = (r: Referendum, pick: (title: string) => boolean, latest = false) => {
  const times = (r.timeline ?? [])
    .filter((event) => pick(event.title))
    .map((event) => Date.parse(event.at))
    .filter((at) => Number.isFinite(at) && at > 0);
  if (!times.length) return null;
  return latest ? Math.max(...times) : Math.min(...times);
};

const isDecisionStart = (title: string) => /decision/i.test(title) && !/deposit/i.test(title);
const isConfirmStart = (title: string) => /confirm[\s_-]*started/i.test(title);

/** Timestamp-based estimates are for list countdowns only, never decision thresholds. */
function estimatedDecisionProgress(r: Referendum, track: Track | undefined, now: number, secondsPerBlock: number | null) {
  if (!track || !isLiveReferendum(r)) return null;
  const startedAt = eventTime(r, isDecisionStart);
  const periodMs = periodToMs(track.decisionPeriod, secondsPerBlock);
  if (startedAt == null || !periodMs) return null;
  const elapsed = now - startedAt;
  return { share: Math.min(1, Math.max(0, elapsed / periodMs)), remainingMs: periodMs - elapsed };
}

type DecisionSnapshot = { now: number; deciding: { since: number; confirming: number | null } | null };

/** The runtime evaluates curves in governance blocks, independently of wall time or block speed. */
export function decisionProgress(snapshot: DecisionSnapshot | null | undefined, track: Pick<Track, "decisionPeriod"> | undefined) {
  if (!snapshot?.deciding || !track || !/^\d+$/.test(track.decisionPeriod)) return null;
  const period = Number(track.decisionPeriod);
  const { now, deciding: { since } } = snapshot;
  if (![now, since, period, since + period].every(Number.isSafeInteger) || since < 0 || now < since || period <= 0) return null;
  const elapsed = now - since;
  return { share: Math.min(1, elapsed / period), remainingBlocks: period - elapsed, endsAt: since + period };
}

/** Exact end block with an optional, explicitly approximate time estimate. */
export function onChainReferendumDeadline(snapshot: DecisionSnapshot | null | undefined, track: Track | undefined, secondsPerBlock: number | null): string | null {
  const progress = decisionProgress(snapshot, track);
  if (!progress || !snapshot?.deciding) return null;
  const confirming = snapshot.deciding.confirming;
  const end = confirming ?? progress.endsAt;
  if (!Number.isSafeInteger(end) || end < 0) return null;
  const remaining = end - snapshot.now;
  if (remaining <= 0) return confirming != null ? "Awaiting confirmation outcome" : "Awaiting decision outcome";
  const estimate = periodToMs(String(remaining), secondsPerBlock);
  return `${confirming != null ? "Confirmation" : "Decision period"} ends at #${end.toLocaleString("en-US")}${estimate != null ? ` (est. ${formatDuration(estimate)})` : ""}`;
}

/**
 * Estimated list countdown from indexed event timestamps. This cannot determine curve thresholds.
 * Returns null when the timeline or duration is unknown.
 */
export function referendumDeadline(r: Referendum, track: Track | undefined, now: number, secondsPerBlock: number | null): string | null {
  if (!track || !isLiveReferendum(r)) return null;
  if (r.status === "Confirming") {
    const confirmStart = eventTime(r, isConfirmStart, true);
    const confirmMs = periodToMs(track.confirmPeriod, secondsPerBlock);
    if (confirmStart != null && confirmMs) {
      const remaining = confirmStart + confirmMs - now;
      return remaining > 0 ? `Est. confirmation in ${formatDuration(remaining)}` : "Confirmation estimate elapsed";
    }
    return null;
  }
  const progress = estimatedDecisionProgress(r, track, now, secondsPerBlock);
  if (!progress) return null;
  return progress.remainingMs > 0 ? `Est. decision end in ${formatDuration(progress.remainingMs)}` : "Decision end estimate elapsed";
}
