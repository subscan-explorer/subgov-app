export function shortAddr(addr: string, size = 4) {
  if (addr.length <= size * 2 + 3) return addr;
  return `${addr.slice(0, size + 2)}…${addr.slice(-size)}`;
}

export function planckToToken(planck: string | undefined | null, decimals: number): string | null {
  if (planck == null || planck === "") return null;
  try {
    const raw = BigInt(planck.replaceAll("_", ""));
    if (raw === BigInt(0)) return "0";
    const base = BigInt(10) ** BigInt(decimals);
    const whole = raw / base;
    const frac = raw % base;
    if (frac === BigInt(0)) return whole.toString();
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    return `${whole}.${fracStr}`;
  } catch {
    return null;
  }
}

/** Group and round a base-unit amount without converting large balances to Number. */
export function formatBaseUnits(amount: string, decimals: number): string | null {
  if (!Number.isSafeInteger(decimals) || decimals < 0 || decimals > 30) return null;
  try {
    const raw = BigInt(amount.replaceAll("_", ""));
    const negative = raw < BigInt(0);
    const absolute = negative ? -raw : raw;
    const base = BigInt(10) ** BigInt(decimals);
    const digits = Math.min(decimals, absolute >= BigInt(1_000) * base ? 2 : 4);
    const divisor = BigInt(10) ** BigInt(decimals - digits);
    const rounded = (absolute + divisor / BigInt(2)) / divisor;
    const fractionBase = BigInt(10) ** BigInt(digits);
    const whole = rounded / fractionBase;
    const fraction = digits ? (rounded % fractionBase).toString().padStart(digits, "0").replace(/0+$/, "") : "";
    const sign = negative && rounded !== BigInt(0) ? "-" : "";
    return `${sign}${new Intl.NumberFormat("en").format(whole)}${fraction ? `.${fraction}` : ""}`;
  } catch {
    return null;
  }
}

export function formatDot(amount: string | number, symbol = "DOT") {
  const n = typeof amount === "string" ? Number(amount.replaceAll("_", "")) : amount;
  if (!Number.isFinite(n)) return `— ${symbol}`;
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(n)} ${symbol}`;
}

export function formatToken(amount: string | null | undefined, symbol = "DOT") {
  if (amount == null) return "—";
  return formatDot(amount, symbol);
}

export function formatPlanck(amount: unknown, decimals: number, symbol: string) {
  const token = planckToToken(amount == null ? null : String(amount), decimals);
  return token == null ? "—" : formatDot(token, symbol);
}

export function formatUsd(amount: string | number, asset = "USDT") {
  const n = typeof amount === "string" ? Number(amount.replaceAll("_", "")) : amount;
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(n)} ${asset}`;
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(iso));
}

export function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

export function pctOrDash(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return pct(n);
}

/** "becameActive" / "pending_payout" → "Became active" / "Pending payout". */
export function formatStatusLabel(status: string) {
  const words = status.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : status;
}

export function statusTone(status: string) {
  const s = status.toLowerCase();
  if (["submitted", "deciding", "active", "open", "pending", "proposed", "preparing"].includes(s)) return "live";
  if (["confirming", "funded", "pendingpayout", "payment initiated", "payment pending"].includes(s)) return "warn";
  if (["paid · awaiting settlement", "approved", "executed", "paid", "claimed", "passed", "completed", "known-good"].includes(s)) return "good";
  if (["payment failed", "rejected", "cancelled", "killed", "timedout", "expired", "notpassed", "executedfailed"].includes(s)) return "bad";
  return "muted";
}

/**
 * Short heading for a list row or page title.
 *
 * Some records, notably bounties, store the whole description in `title`.
 * Collapse whitespace and keep the start of that text. Shorter titles are unchanged.
 */
export function excerptTitle(value: string, limit = 160) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const space = cut.lastIndexOf(" ");
  const base = (space >= Math.floor(limit * 0.6) ? cut.slice(0, space) : cut).replace(/[.,;:]+$/, "");
  return `${base}…`;
}

/** "100,800 blocks" for a numeric block count, "" otherwise. */
export function formatBlocks(value: unknown) {
  const text = String(value ?? "");
  if (!/^\d+$/.test(text)) return "";
  const n = Number(text);
  return `${n.toLocaleString("en-US")} ${n === 1 ? "block" : "blocks"}`;
}

/**
 * Short label for a track period. Digit strings are block counts and use the
 * chain's measured seconds per block. Without that rate, show the block count
 * instead of a duration. Preformatted strings such as "28d" are returned as-is.
 */
export function formatBlockPeriod(value: unknown, secondsPerBlock: number | null) {
  const text = String(value ?? "—");
  if (!/^\d+$/.test(text)) return text;
  if (secondsPerBlock == null || !Number.isFinite(secondsPerBlock) || secondsPerBlock <= 0) return formatBlocks(text) || text;
  const minutes = (Number(text) * secondsPerBlock) / 60;
  if (minutes >= 60 * 24) return `${+(minutes / 60 / 24).toFixed(1)}d`;
  if (minutes >= 60) return `${+(minutes / 60).toFixed(1)}h`;
  return `${Math.round(minutes)}m`;
}
