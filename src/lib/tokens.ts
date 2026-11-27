import { chains } from "@/lib/chains";
import { formatBaseUnits } from "@/lib/format";
import type { SubscanNetwork } from "@/lib/pubfi";
import type { ChainId } from "@/lib/types";

export type TokenMeta = { symbol: string; decimals: number };

/** Known symbols → decimals when Subscan omits the field. */
const SYMBOL_DECIMALS: Record<string, number> = {
  DOT: 10,
  KSM: 12,
  PAS: 10,
  WND: 12,
  USDT: 6,
  USDC: 6,
  DED: 10,
  ETH: 18,
  BTC: 8,
};

const NETWORK_TOKEN: Record<ChainId | SubscanNetwork, TokenMeta> = {
  polkadot: { symbol: "DOT", decimals: 10 },
  kusama: { symbol: "KSM", decimals: 12 },
  paseo: { symbol: "PAS", decimals: 10 },
  statemint: { symbol: "DOT", decimals: 10 },
  "assethub-polkadot": { symbol: "DOT", decimals: 10 },
  "assethub-kusama": { symbol: "KSM", decimals: 12 },
  "assethub-paseo": { symbol: "PAS", decimals: 10 },
};

export function tokenForNetwork(network: ChainId | SubscanNetwork): TokenMeta {
  return NETWORK_TOKEN[network] ?? NETWORK_TOKEN.polkadot;
}

export function tokenForChain(chainId: ChainId): TokenMeta {
  const chain = chains.find((c) => c.id === chainId);
  return chain ? { symbol: chain.symbol, decimals: chain.decimals } : tokenForNetwork(chainId);
}

export function resolveTokenMeta(opts: {
  symbol?: string | null;
  decimals?: number | null;
  network?: ChainId | SubscanNetwork | null;
}): TokenMeta {
  const networkToken = tokenForNetwork(opts.network ?? "polkadot");
  const symbol = (opts.symbol?.trim().toUpperCase() || networkToken.symbol).replace(/\s+/g, "");
  const fromField = opts.decimals != null && Number.isFinite(opts.decimals) ? opts.decimals : undefined;
  const fromSymbol = SYMBOL_DECIMALS[symbol];
  const fromNetwork = symbol === networkToken.symbol ? networkToken.decimals : undefined;
  const decimals = fromField ?? fromSymbol ?? fromNetwork ?? 10;
  return { symbol, decimals };
}

/** Format a base-unit (planck) balance for display. */
function formatAmountValue(
  amount: string | number | bigint | null | undefined,
  decimals: number,
): string | null {
  if (amount == null || amount === "") return null;
  // One precision rule for every asset so amounts compare down a column: 4 places, 2 from 1,000 up.
  return formatBaseUnits(String(amount), decimals);
}

/** Numeric string only (no symbol suffix). */
export function formatAmount(
  amount: string | number | bigint | null | undefined,
  meta: TokenMeta | { symbol?: string | null; decimals?: number | null; network?: ChainId | SubscanNetwork | null },
): string {
  const { decimals } = "decimals" in meta && "symbol" in meta && !("network" in meta)
    ? (meta as TokenMeta)
    : resolveTokenMeta(meta as { symbol?: string | null; decimals?: number | null; network?: ChainId | SubscanNetwork | null });
  return formatAmountValue(amount, decimals) ?? "—";
}

/** Human-readable base-unit balance with symbol, e.g. `38,545 USDC`. */
export function formatBalance(
  amount: string | number | bigint | null | undefined,
  meta: TokenMeta | { symbol?: string | null; decimals?: number | null; network?: ChainId | SubscanNetwork | null },
): string {
  const { symbol, decimals } = "decimals" in meta && "symbol" in meta && !("network" in meta)
    ? (meta as TokenMeta)
    : resolveTokenMeta(meta as { symbol?: string | null; decimals?: number | null; network?: ChainId | SubscanNetwork | null });
  const value = formatAmountValue(amount, decimals);
  if (value == null) return `— ${symbol}`;
  return `${value} ${symbol}`;
}

type AssetLike = Record<string, unknown>;

function nestedAsset(row: AssetLike): AssetLike | undefined {
  for (const key of ["treasury_spend", "value_asset", "asset_info", "token"]) {
    const value = row[key];
    if (value && typeof value === "object") return value as AssetLike;
  }
  return undefined;
}

/** Pull amount + token metadata from a Subscan treasury row. */
export function tokenFromRow(row: AssetLike, network?: ChainId | SubscanNetwork): TokenMeta & { amount: string } {
  const nested = nestedAsset(row);
  const amount = String(
    nested?.amount ?? row.amount ?? row.value ?? row.reward ?? row.amount_str ?? row.balance ?? "0",
  );
  const symbol = String(
    nested?.symbol ?? row.asset_symbol ?? row.symbol ?? row.asset ?? row.token_symbol ?? "",
  );
  const rawDecimals = nested?.decimals ?? row.decimals ?? row.token_decimals;
  const decimals = rawDecimals != null ? Number(rawDecimals) : null;

  return {
    amount,
    ...resolveTokenMeta({ symbol: symbol || undefined, decimals, network }),
  };
}

export function formatRowBalance(row: AssetLike, network?: ChainId | SubscanNetwork): string {
  const { amount, symbol, decimals } = tokenFromRow(row, network);
  return formatBalance(amount, { symbol, decimals });
}
