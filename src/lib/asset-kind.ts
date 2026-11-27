/** Pure helpers for treasury spends and multi-asset bounties on Asset Hub. */

export type AssetMeta = { symbol: string; decimals: number; assetId: number | null };

/** Candidate local treasury holdings; these IDs do NOT identify the same token across chains. */
export const TREASURY_ASSET_IDS = [1337, 1984];
type Location = { parents?: number; interior?: Record<string, unknown> };
export function locatableAsset(assetKind: unknown): { location: Location; assetId: Location } | null {
  if (!assetKind || typeof assetKind !== "object") return null;
  const versioned = Object.entries(assetKind).find(([key]) => /^v[345]$/i.test(key))?.[1];
  if (!versioned || typeof versioned !== "object") return null;
  const { location, assetId } = versioned as { location?: Location; assetId?: Location };
  return location && assetId ? { location, assetId } : null;
}
export const isHere = (location: Location) => Boolean(location.interior && Object.hasOwn(location.interior, "here"));
export const isLocalPayout = (asset: ReturnType<typeof locatableAsset>) => Boolean(asset && asset.location.parents === 0 && isHere(asset.location));

/** Only the local pallet-assets junction has a local numeric ID; remote GeneralIndex values may collide. */
export function localAssetId(assetKind: unknown): number | null {
  const asset = locatableAsset(assetKind);
  if (!isLocalPayout(asset) || asset!.assetId.parents !== 0) return null;
  const x2 = asset!.assetId.interior?.x2;
  if (!Array.isArray(x2) || x2.length !== 2 || x2[0]?.palletInstance !== 50) return null;
  if (!/^\d+$/.test(String(x2[1]?.generalIndex ?? ""))) return null;
  const id = Number(x2[1]?.generalIndex);
  return Number.isSafeInteger(id) && id >= 0 ? id : null;
}

/** Safe fallback when on-chain metadata is unavailable: never guess a foreign asset's denomination. */
export function assetKindMeta(assetKind: unknown, native: { symbol: string; decimals: number }): AssetMeta {
  const asset = locatableAsset(assetKind);
  if (isLocalPayout(asset) && asset!.assetId.parents === 1 && isHere(asset!.assetId)) return { ...native, assetId: null };
  const assetId = localAssetId(assetKind);
  return { symbol: assetId == null ? "Unknown asset (base units)" : `Asset ${assetId} (base units)`, decimals: 0, assetId };
}

export type SpendAction = { action: "payout" | "checkStatus" | null; note: string };
type SpendState = { validFrom?: number; expireAt?: number; status?: unknown; assetKind?: unknown; beneficiary?: unknown };
const spendStatusKey = (status: unknown) => typeof status === "string" ? status.toLowerCase() : status && typeof status === "object" ? Object.keys(status)[0]?.toLowerCase() : "";

/**
 * Asset Hub LocalPay transfers synchronously and returns QueryId::MAX only after success.
 * Require both local locations and the exact sentinel; an arbitrary Attempted/XCM ID is not proof of payment.
 * https://github.com/paritytech/polkadot-sdk/blob/master/cumulus/parachains/common/src/pay.rs
 */
export function isLocallyPaid(spend: SpendState): boolean {
  if (spendStatusKey(spend.status) !== "attempted" || !isLocalPayout(locatableAsset(spend.assetKind))) return false;
  const beneficiary = spend.beneficiary;
  if (!beneficiary || typeof beneficiary !== "object") return false;
  const value = Object.entries(beneficiary).find(([key]) => /^v[45]$/i.test(key))?.[1] as { location?: Location; accountId?: unknown } | undefined;
  if (!value?.accountId || value.location?.parents !== 0 || !isHere(value.location)) return false;
  const attempted = Object.values(spend.status as Record<string, unknown>)[0] as { id?: unknown } | null;
  const id = attempted?.id;
  if (typeof id !== "string" || !/^(?:0x[\da-f]+|\d+)$/i.test(id)) return false;
  return BigInt(id) === BigInt("0xffffffffffffffff");
}

/** Indexed Awarded records mean a payout was initiated; delivery is reconciled separately. */
export function spendStatusLabel(spend: SpendState | null | undefined, indexedStatus: string): string {
  if (spend && spendStatusKey(spend.status) === "attempted") return isLocallyPaid(spend) ? "Paid · awaiting settlement" : "Payment pending";
  if (spend && spendStatusKey(spend.status) === "failed") return "Payment failed";
  return indexedStatus.toLowerCase() === "awarded" ? "Payment initiated" : indexedStatus;
}

/**
 * What `treasury.spends(index)` allows now: `payout` once `validFrom` has passed and before `expireAt` (also after a
 * failed payment), `checkStatus` while a payment is attempted or once the spend has expired.
 */
export function spendAction(spend: SpendState | null, now: number): SpendAction {
  if (!spend) return { action: null, note: "This spend is no longer stored on-chain (paid out, expired or never approved)." };
  const key = spendStatusKey(spend.status);
  if (key === "attempted") return { action: "checkStatus", note: isLocallyPaid(spend) ? "The beneficiary has been paid on this chain. Check status to settle the spend record; this does not pay it again." : "Payment was initiated, but delivery is not confirmed here. Check its status to settle the spend." };
  if (spend.expireAt != null && now > spend.expireAt) return { action: "checkStatus", note: "The spend has expired. Checking its status removes it." };
  if (spend.expireAt != null && now === spend.expireAt) return { action: null, note: "The spend has expired. Its status can be cleared from the next block." };
  if (spend.validFrom != null && now < spend.validFrom) return { action: null, note: `Payable from block #${spend.validFrom.toLocaleString()}.` };
  if (key === "failed") return { action: "payout", note: "The last payment failed. It can be paid out again." };
  return { action: "payout", note: "The spend is approved and payable now." };
}

/** Blocks remaining until the next spend period, given `lastSpendPeriod` and `spendPeriod`. */
export function nextSpendPeriod(lastSpendPeriod: number | null, spendPeriod: number, now: number) {
  if (!Number.isSafeInteger(spendPeriod) || spendPeriod <= 0 || !Number.isSafeInteger(now) || now < 0) return null;
  if (lastSpendPeriod != null && (!Number.isSafeInteger(lastSpendPeriod) || lastSpendPeriod < 0 || lastSpendPeriod > now)) return null;
  const base = lastSpendPeriod ?? Math.floor(now / spendPeriod) * spendPeriod;
  const next = base + (Math.floor((now - base) / spendPeriod) + 1) * spendPeriod;
  if (!Number.isSafeInteger(next)) return null;
  return { at: next, remaining: next - now, share: 1 - (next - now) / spendPeriod };
}

/** Readable text from an on-chain description preimage: JSON `{ title }`, SCALE length prefixes or control bytes. */
export function cleanDescription(raw: string | undefined): string | undefined {
  if (!raw || raw.includes("\ufffd")) return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    try {
      const json = JSON.parse(trimmed) as { title?: unknown; description?: unknown };
      if (typeof json.title === "string") return json.title;
      if (typeof json.description === "string") return json.description;
    } catch {
      // fall through to plain text
    }
  }
  const text = trimmed.replace(/[\u0000-\u0008\u000b-\u001f\u007f\ufffd]/g, "").trim();
  return text || undefined;
}
