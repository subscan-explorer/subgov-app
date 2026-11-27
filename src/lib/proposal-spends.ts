import type { CallNode } from "./call-tree";

export type ProposalSpend = {
  call: string;
  amount: string | null;
  native: boolean;
  assetKind: unknown;
  beneficiary: unknown;
};

/** Accept only exact codec values, never `toHuman()` strings or unsafe JS integers. */
export function spendBaseUnits(value: unknown): string | null {
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) return null;
  if (!["string", "number", "bigint"].includes(typeof value) || !/^(?:\d+|0x[\da-f]+)$/i.test(String(value))) return null;
  return BigInt(String(value)).toString();
}

/** Each transfer stays separate: mixed assets, beneficiaries and nested batches must not be summed. */
export function proposalSpends(tree: CallNode): ProposalSpend[] {
  const result: ProposalSpend[] = [];
  const visit = (node: CallNode) => {
    const method = node.method.replaceAll("_", "").toLowerCase();
    if (node.section.toLowerCase() === "treasury" && ["spend", "spendlocal", "proposespend"].includes(method)) {
      const args = Object.fromEntries(node.args.map((arg) => [arg.name.replaceAll("_", "").toLowerCase(), arg.raw]));
      result.push({ call: `${node.section}.${node.method}`, amount: spendBaseUnits(args.amount ?? args.value), native: method !== "spend", assetKind: args.assetkind, beneficiary: args.beneficiary });
    }
    node.args.forEach((arg) => arg.calls?.forEach(visit));
  };
  visit(tree);
  return result;
}

/** Account junction only; a complex/remote location is preserved for inspection, not guessed. */
export function proposalBeneficiary(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;
  const versioned = Object.entries(record).find(([key]) => /^v[345]$/i.test(key))?.[1];
  const data = versioned && typeof versioned === "object" ? versioned as Record<string, unknown> : record;
  const account = (data.accountId ?? data) as { parents?: number; interior?: { x1?: unknown } };
  if (account.parents !== 0) return null;
  const x1 = account.interior?.x1;
  const junction = (Array.isArray(x1) && x1.length === 1 ? x1[0] : x1) as { accountId32?: { id?: unknown }; accountKey20?: { key?: unknown } } | undefined;
  const id = junction?.accountId32?.id ?? junction?.accountKey20?.key;
  return typeof id === "string" ? id : null;
}

export function exactSpendAmount(amount: string, decimals: number): string {
  const digits = amount.padStart(decimals + 1, "0");
  const integer = (decimals ? digits.slice(0, -decimals) : digits).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = decimals ? digits.slice(-decimals).replace(/0+$/, "") : "";
  return fraction ? `${integer}.${fraction}` : integer;
}
