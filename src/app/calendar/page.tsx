import type { Metadata } from "next";
import Link from "next/link";
import { DataNotice } from "@/components/data-notice";
import { PendingBackend } from "@/components/pending-backend";
import { ChoiceGroup, PageHeader, Panel } from "@/components/ui";
import { withChain } from "@/lib/chain-query";
import { governanceChains } from "@/lib/chains";
import { activeNetwork } from "@/lib/network-server";
import { listOf, optionalGovernance } from "@/lib/subscan-optional";
import { EVENT_LABELS, eventHref, eventsByDay, formatWhen, monthGrid, monthKey, parseDay, parseMonth, type GovernanceEvent, type GovernanceEventType } from "@/lib/subscan-calendar";

export const metadata: Metadata = { title: "Governance calendar" };

const TYPES = Object.keys(EVENT_LABELS) as GovernanceEventType[];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const label = (type: string) => EVENT_LABELS[type as GovernanceEventType] ?? type.replace(/_/g, " ");
const tone = (type: string) => type.startsWith("referendum") ? "bg-live/15 text-live" : type === "treasury_spend_period" ? "bg-aye/15 text-aye" : "bg-panel-2 text-paper";

export default async function Page({ searchParams }: { searchParams: Promise<{ chain?: string; month?: string; day?: string; type?: string }> }) {
  const query = await searchParams;
  const network = await activeNetwork(query.chain);
  const chain = governanceChains[network];
  const day = parseDay(query.day);
  const { year, month } = parseMonth(query.month ?? day?.slice(0, 7));
  const type = TYPES.find((value) => value === query.type);
  const grid = monthGrid(year, month);
  // Endpoint requested in subgov#119.
  const result = await optionalGovernance<{ list?: GovernanceEvent[] }>(network, "scan/governance/events", { start: grid.start, end: grid.end, ...(type ? { types: [type] } : {}) });
  const byDay = eventsByDay(result.available ? listOf<GovernanceEvent>(result.data) : []);
  const today = new Date().toISOString().slice(0, 10);
  const href = (params: Record<string, string | undefined>) => withChain("/calendar/", network, { month: monthKey(year, month), type, ...params });
  const title = new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month, 1)));
  const dayEvents = day ? byDay.get(day) ?? [] : [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker={chain.name} title="Governance calendar" description="Referendum decision and confirmation deadlines, enactments, spend periods and bounty expiries. Future times are estimates from block times; all times UTC." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link className="rounded-full bg-panel px-3 py-2 text-sm text-mute hover:text-paper" href={href({ month: monthKey(year, month - 1), day: undefined })} aria-label="Previous month">←</Link>
          <h2 className="min-w-40 text-center text-lg">{title}</h2>
          <Link className="rounded-full bg-panel px-3 py-2 text-sm text-mute hover:text-paper" href={href({ month: monthKey(year, month + 1), day: undefined })} aria-label="Next month">→</Link>
          <Link className="text-link text-sm" href={withChain("/calendar/", network, { type })}>Today</Link>
        </div>
        <ChoiceGroup aria-label="Event type">
          {[undefined, ...TYPES].map((value) => (
            <Link key={value ?? "all"} href={href({ type: value })} aria-current={value === type ? "page" : undefined}
              className={value === type ? "rounded-full bg-paper px-3 py-1.5 text-xs text-ink" : "rounded-full bg-panel px-3 py-1.5 text-xs text-mute hover:text-paper"}>
              {value ? label(value) : "All"}
            </Link>
          ))}
        </ChoiceGroup>
      </div>
      {!result.available ? <PendingBackend result={result} issue={119} what="Governance events" /> : null}
      <Panel className="overflow-x-auto">
        <div className="grid min-w-[44rem] grid-cols-7 text-xs text-mute">
          {WEEKDAYS.map((weekday) => <div key={weekday} className="border-b border-line px-2 py-2">{weekday}</div>)}
          {grid.weeks.flat().map((cell) => {
            const events = byDay.get(cell.day) ?? [];
            return (
              <Link key={cell.day} href={href({ month: cell.day.slice(0, 7), day: cell.day })} aria-current={cell.day === day ? "date" : undefined}
                className={`min-h-24 border-b border-r border-line p-2 hover:bg-panel-2 ${cell.inMonth ? "" : "opacity-40"} ${cell.day === day ? "bg-panel-2" : ""}`}>
                <span className={`num inline-block rounded-full px-1.5 ${cell.day === today ? "bg-paper text-ink" : "text-paper"}`}>{Number(cell.day.slice(8))}</span>
                <span className="mt-1 flex flex-col gap-1">
                  {events.slice(0, 3).map((event, index) => <span key={index} className={`truncate rounded px-1.5 py-0.5 ${tone(event.type)}`}>{label(event.type)}{event.referendum_index != null ? ` #${event.referendum_index}` : ""}</span>)}
                  {events.length > 3 ? <span>+{events.length - 3} more</span> : null}
                </span>
              </Link>
            );
          })}
        </div>
      </Panel>
      {day ? (
        <section aria-label={`Events on ${day}`}>
          <h2 className="mb-3 text-lg">{new Intl.DateTimeFormat("en", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))}</h2>
          {dayEvents.length === 0 ? <DataNotice kind="empty">{result.available ? "No governance events on this day." : "Events will appear here once the backend serves them."}</DataNotice> : (
            <Panel className="divide-y divide-line">
              {dayEvents.map((event, index) => {
                const target = eventHref(event);
                const body = (
                  <>
                    <span className={`rounded px-2 py-0.5 text-xs ${tone(event.type)}`}>{label(event.type)}</span>
                    <span className="min-w-0 flex-1 truncate">{event.title ?? (event.referendum_index != null ? `Referendum #${event.referendum_index}` : event.bounty_id != null ? `Bounty #${event.bounty_id}` : "")}</span>
                    <span className="num text-xs text-mute">{event.estimated ? "≈ " : ""}{formatWhen(event.time)} UTC{event.block_num ? ` · #${event.block_num.toLocaleString()}` : ""}</span>
                  </>
                );
                return target ? <Link key={index} href={withChain(target, network)} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-panel-2">{body}</Link>
                  : <div key={index} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">{body}</div>;
              })}
            </Panel>
          )}
        </section>
      ) : null}
    </div>
  );
}
