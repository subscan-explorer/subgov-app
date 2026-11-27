export const formatWhen = (unix: number) =>
  new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(unix * 1000));

export type GovernanceEventType = "referendum_decision_end" | "referendum_confirm_end" | "referendum_enactment" | "treasury_spend_period" | "bounty_expiry";
export type GovernanceEvent = { type: GovernanceEventType | string; time: number; block_num?: number; estimated?: boolean; referendum_index?: number; bounty_id?: number; title?: string };

export const EVENT_LABELS: Record<GovernanceEventType, string> = {
  referendum_decision_end: "Decision ends",
  referendum_confirm_end: "Confirmation ends",
  referendum_enactment: "Enactment",
  treasury_spend_period: "Spend period",
  bounty_expiry: "Bounty expires",
};

/** Validate real UTC dates without accepting Date's month/day overflow normalization. */
export function parseDay(value: string | undefined): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}

/** `YYYY-MM` → UTC month; invalid or missing input falls back to the month of `now`. */
export function parseMonth(value: string | undefined, now = new Date()) {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  const year = match ? Number(match[1]) : now.getUTCFullYear();
  const month = match ? Number(match[2]) - 1 : now.getUTCMonth();
  if (month < 0 || month > 11) return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
  return { year, month };
}

export const monthKey = (year: number, month: number) => {
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
export const dayKey = (unix: number) => new Date(unix * 1000).toISOString().slice(0, 10);

/** Monday-first weeks covering the month, as `YYYY-MM-DD` (UTC) with an in-month flag, plus the unix range. */
export function monthGrid(year: number, month: number) {
  const first = Date.UTC(year, month, 1);
  const offset = (new Date(first).getUTCDay() + 6) % 7;
  const start = first - offset * 86_400_000;
  const nextMonth = Date.UTC(year, month + 1, 1);
  const weeks: { day: string; inMonth: boolean }[][] = [];
  for (let cursor = start; cursor < nextMonth || weeks.at(-1)?.length !== 7; cursor += 86_400_000) {
    if (!weeks.length || weeks.at(-1)!.length === 7) weeks.push([]);
    weeks.at(-1)!.push({ day: new Date(cursor).toISOString().slice(0, 10), inMonth: new Date(cursor).getUTCMonth() === ((month % 12) + 12) % 12 });
  }
  return { weeks, start: Math.floor(first / 1000), end: Math.floor(nextMonth / 1000) - 1 };
}

export function eventsByDay(events: GovernanceEvent[]) {
  const days = new Map<string, GovernanceEvent[]>();
  for (const event of [...events].sort((a, b) => a.time - b.time)) {
    if (!Number.isFinite(event.time) || event.time <= 0) continue;
    const key = dayKey(event.time);
    days.set(key, [...(days.get(key) ?? []), event]);
  }
  return days;
}

/** Internal page for an event, when it points at a record subgov shows. */
export function eventHref(event: GovernanceEvent) {
  if (event.referendum_index != null) return `/referenda/${event.referendum_index}/`;
  if (event.bounty_id != null) return `/treasury/bounties/${event.bounty_id}/`;
  if (event.type === "treasury_spend_period") return "/treasury/";
  return undefined;
}
