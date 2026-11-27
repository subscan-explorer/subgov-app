import type { ApiPromise } from "@polkadot/api";
import { hexToString, stringToU8a, u8aConcat } from "@polkadot/util";
import { encodeAddress } from "@polkadot/util-crypto";
import { governanceBlockNumber } from "./account-chain";
import { getChainApi } from "./chain-api";
import { assetKindMeta, isHere, isLocalPayout, localAssetId, locatableAsset, TREASURY_ASSET_IDS, nextSpendPeriod, spendAction, type AssetMeta } from "./asset-kind";

type Json = { toJSON: () => unknown };
type Chain = { rpc: string; genesisHash: `0x${string}`; symbol: string; decimals: number };

function metadataOf(value: unknown): { symbol: string; decimals: number } | null {
  const meta = value as { symbol?: string; decimals?: number } | null;
  if (!meta?.symbol || !Number.isInteger(meta.decimals) || meta.decimals! < 0 || meta.decimals! > 255) return null;
  const symbol = meta.symbol.startsWith("0x") ? hexToString(meta.symbol) : meta.symbol;
  return symbol ? { symbol, decimals: meta.decimals! } : null;
}

/** Resolve metadata on the payout chain, including foreign assets such as DOT held on Kusama AH. */
export async function readAssetMeta(api: ApiPromise, assetKind: unknown, native: { symbol: string; decimals: number }): Promise<AssetMeta> {
  const fallback = assetKindMeta(assetKind, native);
  const asset = locatableAsset(assetKind);
  if (!isLocalPayout(asset) || (asset!.assetId.parents === 1 && isHere(asset!.assetId))) return fallback;
  const id = localAssetId(assetKind);
  const query = id != null ? api.query.assets?.metadata : api.query.foreignAssets?.metadata;
  if (!query) return fallback;
  try {
    const value = await query(id ?? asset!.assetId) as unknown as Json;
    const meta = metadataOf(value.toJSON());
    return meta ? { ...meta, assetId: id } : fallback;
  } catch {
    // Unknown/unregistered or remote assets stay explicitly in base units.
    return fallback;
  }
}

/** `PalletId::into_account_truncating`: "modl" ++ pallet id, zero-padded to 32 bytes. */
export function palletAccount(api: ApiPromise, palletId: Uint8Array) {
  const raw = new Uint8Array(32);
  raw.set(u8aConcat(stringToU8a("modl"), palletId).slice(0, 32));
  return encodeAddress(raw, api.registry.chainSS58);
}

export type TreasuryOverview = {
  account: string;
  balances: { symbol: string; decimals: number; free: bigint }[];
  spendPeriod: number;
  burnPermill: number;
  next: ReturnType<typeof nextSpendPeriod>;
  now: number;
};

export async function readTreasuryOverview(chain: Chain): Promise<TreasuryOverview> {
  const api = await getChainApi(chain.rpc, chain.genesisHash);
  const palletId = api.consts.treasury.palletId as unknown as { toU8a: () => Uint8Array };
  const account = palletAccount(api, palletId.toU8a());
  const assetIds = api.query.assets?.account && api.query.assets?.metadata ? TREASURY_ASSET_IDS : [];
  const [native, assets, metadata, now, last] = await Promise.all([
    api.query.system.account(account) as unknown as Promise<Json>,
    Promise.all(assetIds.map((id) => api.query.assets.account(id, account) as unknown as Promise<Json>)),
    Promise.all(assetIds.map((id) => api.query.assets.metadata(id) as unknown as Promise<Json>)),
    governanceBlockNumber(api),
    api.query.treasury.lastSpendPeriod ? (api.query.treasury.lastSpendPeriod() as unknown as Promise<Json>) : Promise.resolve(null),
  ]);
  const free = BigInt(String((native.toJSON() as { data?: { free?: string | number } }).data?.free ?? 0));
  const spendPeriod = Number((api.consts.treasury.spendPeriod as unknown as Json).toJSON());
  const lastValue = last ? Number(last.toJSON() ?? 0) || null : null;
  return {
    account,
    balances: [
      { symbol: chain.symbol, decimals: chain.decimals, free },
      ...assetIds.flatMap((id, index) => {
        const meta = metadataOf(metadata[index].toJSON());
        return meta ? [{ ...meta, free: BigInt(String((assets[index].toJSON() as { balance?: string | number } | null)?.balance ?? 0)) }] : [];
      }),
    ],
    spendPeriod,
    burnPermill: Number((api.consts.treasury.burn as unknown as Json).toJSON()),
    next: nextSpendPeriod(lastValue, spendPeriod, now),
    now,
  };
}

export type OnChainSpend = { validFrom?: number; expireAt?: number; status?: unknown; amount?: string; assetKind?: unknown; beneficiary?: unknown; asset: ReturnType<typeof assetKindMeta> } | null;

/** The page may have been open across expiry or another payout; recheck before asking for a signature. */
export async function buildSpendAction(api: ApiPromise, index: number, action: "payout" | "checkStatus") {
  const [value, now] = await Promise.all([api.query.treasury.spends(index) as unknown as Promise<Json>, governanceBlockNumber(api)]);
  const current = spendAction(value.toJSON() as Exclude<OnChainSpend, null> | null, now);
  if (current.action !== action) throw new Error(`Spend status changed. ${current.note} Refresh the page before trying again.`);
  return action === "payout" ? api.tx.treasury.payout(index) : api.tx.treasury.checkStatus(index);
}

export async function readSpend(chain: Chain, index: number): Promise<{ spend: OnChainSpend; now: number }> {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error("Invalid spend index");
  const api = await getChainApi(chain.rpc, chain.genesisHash);
  const snapshot = await api.at(await api.rpc.chain.getFinalizedHead());
  const [value, now] = await Promise.all([snapshot.query.treasury.spends(index) as unknown as Promise<Json>, governanceBlockNumber(snapshot)]);
  const json = value.toJSON() as { validFrom?: number; expireAt?: number; status?: unknown; amount?: string | number; assetKind?: unknown; beneficiary?: unknown } | null;
  return {
    now,
    spend: json ? { ...json, amount: json.amount != null ? String(json.amount) : undefined, asset: await readAssetMeta(api, json.assetKind, chain) } : null,
  };
}

export type MultiAssetBounty = { id: number; value: string; asset: ReturnType<typeof assetKindMeta>; status: string; curator?: string; metadata?: string; description?: string };
export type MultiAssetChild = { parentId: number; id: number; value: string; status: string; curator?: string; description?: string };

function statusOf(value: unknown) {
  const key = typeof value === "string" ? value : value && typeof value === "object" ? Object.keys(value)[0] : "unknown";
  const body = value && typeof value === "object" ? Object.values(value)[0] as { curator?: string } | null : null;
  return { status: key ? key[0].toUpperCase() + key.slice(1) : "Unknown", curator: body && typeof body === "object" ? body.curator : undefined };
}

async function preimageText(api: ApiPromise, hash?: string): Promise<string | undefined> {
  if (!hash || !api.query.preimage?.requestStatusFor) return undefined;
  try {
    const status = (await api.query.preimage.requestStatusFor(hash) as unknown as Json).toJSON() as Record<string, { len?: number; maybeLen?: number }> | null;
    const len = status ? Object.values(status)[0]?.len ?? Object.values(status)[0]?.maybeLen : undefined;
    if (len == null) return undefined;
    const bytes = await api.query.preimage.preimageFor([hash, len]) as unknown as { isSome: boolean; unwrap: () => Uint8Array };
    return bytes.isSome ? new TextDecoder("utf-8", { fatal: true }).decode(bytes.unwrap()) : undefined;
  } catch {
    return undefined;
  }
}

/** `multiAssetBounties.bounties` with descriptions from their metadata preimage. */
export async function readMultiAssetBounties(chain: Chain): Promise<MultiAssetBounty[] | null> {
  const api = await getChainApi(chain.rpc, chain.genesisHash);
  if (!api.query.multiAssetBounties?.bounties) return null;
  const entries = await api.query.multiAssetBounties.bounties.entries() as unknown as [{ args: { toString: () => string }[] }, Json][];
  const rows = (await Promise.all(entries.map(async ([key, value]) => {
    const json = value.toJSON() as { assetKind?: unknown; value?: string | number; metadata?: string; status?: unknown };
    return { id: Number(key.args[0].toString()), value: String(json.value ?? 0), asset: await readAssetMeta(api, json.assetKind, chain), metadata: json.metadata, ...statusOf(json.status) };
  }))).sort((a, b) => b.id - a.id);
  const descriptions = await Promise.all(rows.map((row) => preimageText(api, row.metadata)));
  return rows.map((row, index) => ({ ...row, description: descriptions[index] }));
}

export async function readMultiAssetChildren(chain: Chain, parentId: number): Promise<MultiAssetChild[]> {
  const api = await getChainApi(chain.rpc, chain.genesisHash);
  if (!api.query.multiAssetBounties?.childBounties) return [];
  const entries = await api.query.multiAssetBounties.childBounties.entries(parentId) as unknown as [{ args: { toString: () => string }[] }, Json][];
  const rows = entries.map(([key, value]) => {
    const json = value.toJSON() as { value?: string | number; metadata?: string; status?: unknown };
    return { parentId, id: Number(key.args[1].toString()), value: String(json.value ?? 0), metadata: json.metadata, ...statusOf(json.status) };
  }).sort((a, b) => a.id - b.id);
  const descriptions = await Promise.all(rows.map((row) => preimageText(api, row.metadata)));
  return rows.map(({ metadata: _metadata, ...row }, index) => ({ ...row, description: descriptions[index] }));
}

