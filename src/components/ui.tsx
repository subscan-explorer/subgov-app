import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { excerptTitle, formatStatusLabel, statusTone } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ComponentProps, HTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

type ButtonVariant = "brass" | "ghost" | "aye" | "nay" | "line" | "selected";
type ButtonSize = "sm" | "md" | "lg";

const buttonStyles: Record<ButtonVariant, string> = {
  brass: "subscan-button-primary",
  ghost: "subscan-button-outline",
  line: "subscan-button-plain",
  selected: "subscan-button-selected",
  aye: "subscan-button-aye",
  nay: "subscan-button-nay",
};

function buttonClass(variant: ButtonVariant, size: ButtonSize, className?: string) {
  return cn("subscan-button", buttonStyles[variant], size !== "md" && `subscan-button-${size}`, className);
}

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "live" | "warn" | "good" | "bad" | "brass";
  className?: string;
}) {
  const tones: Record<string, string> = {
    muted: "bg-panel-2 text-paper",
    live: "border-live/20 bg-live/10 text-link",
    warn: "border-warning/20 bg-warning/10 text-warning",
    good: "border-aye/20 bg-aye/10 text-aye",
    bad: "border-nay/20 bg-nay/10 text-nay",
    brass: "border-line-2 text-paper",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-[11px] py-[4px] text-xs whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const trackHues: Record<string, number> = {
  root: 220,
  "whitelisted caller": 205,
  "wish for change": 270,
  "staking admin": 165,
  treasurer: 35,
  "lease admin": 195,
  "fellowship admin": 240,
  "general admin": 145,
  "auction admin": 325,
  "referendum canceller": 0,
  "referendum killer": 350,
  "small tipper": 110,
  "big tipper": 90,
  "small spender": 190,
  "medium spender": 45,
  "big spender": 305,
};

function trackHue(label: string) {
  const normalized = label.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  if (trackHues[normalized] != null) return trackHues[normalized];

  let hash = 0;
  for (const character of normalized) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return (hash >>> 0) % 360;
}

export function TrackBadge({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={cn("track-badge inline-flex shrink-0 items-center whitespace-nowrap", className)}
      style={{ "--track-hue": trackHue(label) } as React.CSSProperties}
    >
      {label}
    </span>
  );
}

/** Status as a coloured dot + label (same vocabulary as the Overview charts). */
export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status);
  const key = status.toLowerCase();
  const dot = key === "deciding" ? "accent"
    : key === "confirming" ? "ink"
    : key === "preparing" || key === "submitted" ? "prep"
    : tone === "good" ? "aye"
    : tone === "bad" ? "nay"
    : tone === "live" || tone === "warn" ? "accent"
    : "other";
  return (
    <span className="subscan-status">
      <i className={`status-dot status-dot-${dot} status-icon-${key}`} aria-hidden="true" />
      {formatStatusLabel(status)}
    </span>
  );
}

export function Button({
  variant = "brass",
  size = "md",
  className,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      type={type ?? "button"}
      className={buttonClass(variant, size, className)}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "brass",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function TextButton({
  tone = "link",
  className,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "neutral" | "link" | "danger" }) {
  return <button type={type ?? "button"} className={cn("subscan-text-button", `subscan-text-button-${tone}`, className)} {...props} />;
}

export function IconButton({
  variant = "outline",
  className,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "outline" | "plain" }) {
  return <button type={type ?? "button"} className={cn("subscan-icon-button", `subscan-icon-button-${variant}`, className)} {...props} />;
}

export function MenuItem({
  selected = false,
  className,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return <button type={type ?? "button"} aria-pressed={selected} className={cn("subscan-menu-item", selected && "is-selected", className)} {...props} />;
}

export function ChoiceButton({
  selected = false,
  variant = "card",
  className,
  type,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; variant?: "card" | "list" }) {
  return <button type={type ?? "button"} aria-pressed={selected} className={cn("subscan-choice", `subscan-choice-${variant}`, selected && "is-selected", className)} {...props} />;
}

export function ChoiceGroup({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("subscan-choice-group", className)} {...props} />;
}

export function Field({
  label,
  description,
  error,
  children,
}: {
  label: string;
  description?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-2 text-sm">
      <span className="text-xs font-medium text-mute">{label}</span>
      {children}
      {description ? <span className="text-xs leading-5 text-mute">{description}</span> : null}
      {error ? <span className="text-xs leading-5 text-nay" role="alert">{error}</span> : null}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "subscan-input w-full outline-none focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2 placeholder:text-mute",
        props.className,
      )}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      {...props}
      className={cn(
        "subscan-input w-full outline-none focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2 placeholder:text-mute",
        props.className,
      )}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "subscan-input subscan-select outline-none focus-visible:outline-2 focus-visible:outline-link focus-visible:outline-offset-2",
        className,
      )}
    />
  );
}

export function Checkbox(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input {...props} type="checkbox" className={cn("subscan-checkbox", props.className)} />;
}

export function Panel({
  padding = "none",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { padding?: "none" | "compact" | "content" | "spacious" | "inline" }) {
  const paddingStyles = {
    none: "",
    compact: "p-5",
    content: "p-5 sm:p-6",
    spacious: "p-6 sm:p-8",
    inline: "px-5",
  };
  return (
    <div
      className={cn("subscan-panel min-w-0", paddingStyles[padding], className)}
      {...props}
    />
  );
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  back,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  const heading = excerptTitle(title);
  return (
    <div className="flex flex-col gap-4">
      {back ? (
        <Link href={back.href} className="back-link group inline-flex w-fit items-center gap-1.5 text-sm text-link">
          <ArrowLeft size={16} aria-hidden="true" className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] group-hover:-translate-x-0.5" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 w-full md:w-auto md:flex-1">
          {kicker ? <p className="mb-1.5 text-xs font-medium text-mute">{kicker}</p> : null}
          <h1 className="page-title text-paper [overflow-wrap:anywhere]">{heading}</h1>
          {description && description.trim() !== title.trim() ? <p className="mt-2 max-w-2xl break-words text-sm leading-6 text-mute">{description}</p> : null}
        </div>
        {actions ? <div className="flex max-w-full flex-wrap items-center gap-2 md:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Page-level section heading (not a panel title — panels use ModuleHeader). */
export function SectionHeader({
  title,
  id,
  meta,
  action,
}: {
  title: React.ReactNode;
  id?: string;
  meta?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id={id} className="section-title text-paper">{title}</h2>
        {meta ? <span className="text-sm text-mute">{meta}</span> : null}
      </div>
      {action ? (
        <Link href={action.href} className="section-action">
          {action.label}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export function ArrowLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("group inline-flex w-fit items-center gap-1 text-sm text-link", className)}>
      {children}
      <ArrowRight size={15} aria-hidden="true" className="transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] group-hover:translate-x-0.5" />
    </Link>
  );
}

/**
 * One anatomy for every record list: identifier · status/badges · title · supporting line · one primary value.
 * Rows are direct children of a flush Panel so hover fills the panel edge to edge.
 */
export function RecordRow({
  href,
  id,
  badges,
  title,
  meta,
  value,
  valueLabel,
  meter,
}: {
  href: string;
  id?: React.ReactNode;
  badges?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  value?: React.ReactNode;
  valueLabel?: React.ReactNode;
  /** Optional aye share (0–100) drawn as a small aye/nay bar under the value. */
  meter?: number | null;
}) {
  const label = typeof title === "string" ? excerptTitle(title) : title;
  return (
    <Link href={href} className="record-row" aria-label={typeof label === "string" ? [id, label].filter(Boolean).join(" ") : undefined}>
      <span className="record-row-id num">{id}</span>
      <span className="record-row-body">
        {badges ? <span className="flex flex-wrap items-center gap-2">{badges}</span> : null}
        <span className="record-title">{label}</span>
        {meta ? <span className="record-row-meta">{meta}</span> : null}
      </span>
      <span className="record-row-value">
        {valueLabel ? <span className="block text-xs text-mute">{valueLabel}</span> : null}
        {value != null ? <span className="num block text-paper">{value}</span> : null}
        {meter != null && Number.isFinite(meter) ? (
          <span className="record-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, meter))}%` }} /></span>
        ) : null}
      </span>
    </Link>
  );
}

/** Label/value pairs for detail sidebars. */
export function MetaList({ children }: { children: React.ReactNode }) {
  return <dl className="meta-list">{children}</dl>;
}

export function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="meta-item">
      <dt className="text-xs font-medium text-mute">{label}</dt>
      <dd className="mt-1 text-sm [overflow-wrap:anywhere]">{value}</dd>
    </div>
  );
}

/**
 * Detail pages. Narrow: lead (tally / status) → reading column → details.
 * ≥1200px: reading column plus a 320px sidebar (lead + details) that stays in view.
 */
export function DetailLayout({ lead, main, details }: { lead?: React.ReactNode; main: React.ReactNode; details?: React.ReactNode }) {
  return (
    <div className="detail-layout">
      <div className="detail-side">
        {lead ? <div className="detail-lead">{lead}</div> : null}
        {details ? <div className="detail-details">{details}</div> : null}
      </div>
      <div className="detail-main">{main}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Panel padding="spacious" className="py-12 text-center text-sm text-mute">{children}</Panel>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Panel padding="content" className="min-w-0">
      <div className="text-sm text-mute">{label}</div>
      <div className="mt-2 text-[36px] font-normal leading-none tracking-[-0.03em] tabular-nums text-paper">{value}</div>
      {hint ? <div className="mt-1 text-xs leading-5 text-mute">{hint}</div> : null}
    </Panel>
  );
}

/** Several figures in one module; stays a single compact row on phones. */
export function StatStrip({ items }: { items: { label: string; value: React.ReactNode; hint?: React.ReactNode }[] }) {
  return (
    <Panel className="stat-strip" data-cols={items.length} style={{ "--stat-cols": items.length } as React.CSSProperties}>
      {items.map((item) => (
        <div key={item.label} className="stat-cell">
          <div className="text-xs text-mute sm:text-sm">{item.label}</div>
          <div className="stat-cell-value text-paper">{item.value}</div>
          {item.hint ? <div className="mt-1 hidden text-xs leading-5 text-mute sm:block">{item.hint}</div> : null}
        </div>
      ))}
    </Panel>
  );
}

export function ModuleHeader({ title, meta, id }: { title: React.ReactNode; meta?: React.ReactNode; id?: string }) {
  return <div className="module-header"><h2 id={id} className="min-w-0 font-normal text-paper">{title}</h2>{meta ? <div className="text-xs text-mute">{meta}</div> : null}</div>;
}
