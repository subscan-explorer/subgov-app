/**
 * Decoded runtime calls as a plain tree for display. Nested calls (utility.batch*, proxy.proxy,
 * whitelist.dispatchWhitelistedCallWithPreimage, scheduler, …) become child nodes.
 */
export type CallNode = {
  section: string;
  method: string;
  docs?: string;
  args: CallArg[];
};

export type CallArg = { name: string; type: string; value?: string; raw?: unknown; calls?: CallNode[] };

/** The subset of a polkadot.js `Call` the tree needs, so the builder can be tested without a runtime. */
export type CallLike = {
  section: string;
  method: string;
  meta?: { docs?: { toString: () => string }[]; args?: { name: { toString: () => string }; type: { toString: () => string } }[] };
  args: unknown[];
};

const isCall = (value: unknown): value is CallLike =>
  Boolean(value && typeof value === "object" && "section" in value && "method" in value && Array.isArray((value as CallLike).args));

function display(value: unknown): string {
  if (value == null) return "—";
  const human = (value as { toHuman?: () => unknown }).toHuman?.();
  const raw = human !== undefined ? human : (value as { toJSON?: () => unknown }).toJSON?.() ?? value;
  if (typeof raw === "string") return raw;
  try {
    return JSON.stringify(raw, (_, item) => (typeof item === "bigint" ? item.toString() : item), 1);
  } catch {
    return String(raw);
  }
}

const MAX_DEPTH = 8;

export function callTree(call: CallLike, depth = 0): CallNode {
  const metaArgs = call.meta?.args ?? [];
  return {
    section: call.section,
    method: call.method,
    docs: call.meta?.docs?.map((line) => line.toString()).join(" ").trim().split(/(?<=\.)\s/)[0] || undefined,
    args: call.args.map((value, index) => {
      const name = metaArgs[index]?.name.toString() ?? `arg${index}`;
      const type = metaArgs[index]?.type.toString() ?? "";
      if (depth < MAX_DEPTH && isCall(value)) return { name, type, calls: [callTree(value, depth + 1)] };
      if (depth < MAX_DEPTH && Array.isArray(value) && value.length && value.every(isCall)) {
        return { name, type, calls: (value as CallLike[]).map((item) => callTree(item, depth + 1)) };
      }
      // Display strings may contain rounded balances and separators. Keep codec JSON for summaries.
      const raw = value == null ? value : (value as { toJSON?: () => unknown }).toJSON?.() ?? value;
      return { name, type, value: display(value), raw };
    }),
  };
}

/** Number of calls in the tree, the root included. */
export function callCount(node: CallNode): number {
  return 1 + node.args.reduce((sum, arg) => sum + (arg.calls ?? []).reduce((n, child) => n + callCount(child), 0), 0);
}

/** `{ lookup: { hash, len } }`, `{ inline: "0x…" }` or `{ legacy: { hash } }` from `referendumInfoFor(..).ongoing.proposal`. */
export function parseBoundedCall(value: unknown): { hash?: string; len?: number; inline?: string } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, { hash?: string; len?: number } | string | undefined>;
  const lookup = record.lookup ?? record.Lookup;
  if (lookup && typeof lookup === "object") return { hash: lookup.hash, len: Number(lookup.len) };
  const inline = record.inline ?? record.Inline;
  if (typeof inline === "string") return { inline };
  const legacy = record.legacy ?? record.Legacy;
  if (legacy && typeof legacy === "object") return { hash: legacy.hash };
  return null;
}
