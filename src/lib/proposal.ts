import type { ApiPromise } from "@polkadot/api";
import type { Signer } from "@polkadot/api/types";
import { hexToU8a, isHex, stringToHex, u8aToHex } from "@polkadot/util";
import { blake2AsHex, decodeAddress } from "@polkadot/util-crypto";
import { governanceChains } from "./chains";
import { getChainApi } from "./chain-api";
import { tokenAmountToPlanck } from "./vote";


export type ProposalTemplate = "treasury" | "usdx-treasury" | "batch-treasury" | "multi-asset-bounty" | "remark" | "cancel" | "kill" | "new-preimage" | "existing-preimage";
export type ProposalNetwork = { rpc: string; genesisHash: `0x${string}`; decimals: number; symbol: string };
export type ProposalDraft = { template: ProposalTemplate; fields: Record<string, string>; origin: string; enactmentBlocks: string };
export type ProposalProgress = "Connecting to network" | "Validating proposal" | "Awaiting wallet signature" | "Broadcasting" | "In block" | "Finalized";
export type ProposalCapability = { enabled: boolean; reason?: string; allowedOrigins: string[] };
export type ProposalOrigin = { value: string; label: string; trackId: number; minEnactmentBlocks: number };
export type ProposalAsset = { symbol: string; assetId: string; decimals: number };
export type ProposalCapabilities = {
  runtime: { specName: string; specVersion: number };
  origins: ProposalOrigin[];
  templates: Record<ProposalTemplate, ProposalCapability>;
  assets: ProposalAsset[];
};
export type ProposalPreview = {
  method: string;
  callHex: `0x${string}`;
  callHash: `0x${string}`;
  callLength: number;
  preimageExists: boolean;
  submissionMethod: string;
};
export type ProposalResult = { txHash: string; blockHash: string; referendumIndex: number };

type JsonObject = Record<string, unknown>;
type InnerProposal = { method: string; callHex: `0x${string}`; extraPreimages: `0x${string}`[] };
type Fraction = { numerator: bigint; denominator: bigint };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function required(fields: Record<string, string>, name: string) {
  const value = fields[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function unsignedInteger(value: string, label: string, allowZero = true) {
  if (!/^\d+$/.test(value.trim())) throw new Error(`${label} must be a whole number`);
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < (allowZero ? 0 : 1)) throw new Error(`Invalid ${label.toLowerCase()}`);
  return number;
}

function hash32(value: string, label = "Hash") {
  const hash = value.trim();
  if (!isHex(hash, 256)) throw new Error(`${label} must be a 32-byte hex value`);
  return hash.toLowerCase() as `0x${string}`;
}

function accountIdHex(address: string) {
  try {
    return u8aToHex(decodeAddress(address));
  } catch {
    throw new Error("Beneficiary must be a valid Substrate address");
  }
}

function assetKind(assetId: string) {
  const id = unsignedInteger(assetId, "Asset ID");
  return { V4: { location: { parents: 0, interior: "Here" }, assetId: { parents: 0, interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: id }] } } } };
}

function assetBeneficiary(address: string, locatable: boolean) {
  const location = { parents: 0, interior: { X1: [{ AccountId32: { network: null, id: accountIdHex(address) } }] } };
  return locatable ? { V4: { location: { parents: 0, interior: "Here" }, accountId: location } } : { V4: location };
}

function trackNameToOrigin(name: string) {
  if (name === "root") return { system: "Root" };
  return { Origins: name.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join("") };
}

function parseTracks(api: ApiPromise): ProposalOrigin[] {
  const value = api.consts.referenda?.tracks?.toJSON() as unknown;
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[1] !== "object" || !entry[1]) return [];
    const info = entry[1] as JsonObject;
    const trackId = Number(entry[0]);
    const name = String(info.name ?? "").replace(/\0/g, "").trim();
    const minEnactmentBlocks = Number(info.minEnactmentPeriod);
    if (!Number.isSafeInteger(trackId) || !name || !Number.isSafeInteger(minEnactmentBlocks)) return [];
    return [{ value: name, label: name.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "), trackId, minEnactmentBlocks }];
  });
}

async function connect(network: ProposalNetwork) {
  return getChainApi(network.rpc, network.genesisHash);
}

function unsupported(enabled: boolean, reason: string, allowedOrigins: string[]): ProposalCapability {
  return enabled ? { enabled, allowedOrigins } : { enabled, reason, allowedOrigins: [] };
}

const treasuryOriginNames = ["small_tipper", "big_tipper", "small_spender", "medium_spender", "big_spender", "treasurer"];

function templateCapabilities(api: ApiPromise, assets: ProposalAsset[], origins: ProposalOrigin[]): Record<ProposalTemplate, ProposalCapability> {
  const submit = Boolean(api.tx.referenda?.submit);
  const preimage = Boolean(api.tx.preimage?.notePreimage);
  const batchAll = Boolean(api.tx.utility?.batchAll);
  const reason = "This runtime does not expose the required pallet call";
  const all = origins.map(({ value }) => value);
  const treasury = all.filter((value) => treasuryOriginNames.includes(value));
  const only = (value: string) => all.includes(value) ? [value] : [];
  return {
    treasury: unsupported(submit && preimage && batchAll && Boolean(api.tx.treasury?.spendLocal) && treasury.length > 0, reason, treasury),
    "usdx-treasury": unsupported(submit && preimage && batchAll && Boolean(api.tx.treasury?.spend) && assets.length > 0 && treasury.length > 0, assets.length ? reason : "No supported USDx assets could be verified on Asset Hub", treasury),
    "batch-treasury": unsupported(submit && preimage && batchAll && Boolean(api.tx.utility?.batchAll) && Boolean(api.tx.treasury?.spendLocal || api.tx.treasury?.spend) && treasury.length > 0, reason, treasury),
    "multi-asset-bounty": unsupported(submit && preimage && batchAll && Boolean(api.tx.multiAssetBounties?.fundBounty) && assets.length > 0 && treasury.length > 0, assets.length ? "This runtime does not support funding multi-asset bounties" : "No supported USDx assets could be verified on Asset Hub", treasury),
    remark: unsupported(submit && preimage && batchAll && Boolean(api.tx.system?.remark), reason, all),
    cancel: unsupported(submit && preimage && batchAll && Boolean(api.tx.referenda?.cancel) && only("referendum_canceller").length > 0, reason, only("referendum_canceller")),
    kill: unsupported(submit && preimage && batchAll && Boolean(api.tx.referenda?.kill) && only("referendum_killer").length > 0, reason, only("referendum_killer")),
    "new-preimage": unsupported(submit && preimage && batchAll, reason, all),
    "existing-preimage": unsupported(submit, reason, all),
  };
}

async function queryKnownAssets(api: ApiPromise): Promise<ProposalAsset[]> {
  if (!api.query.assets?.asset || !api.query.assets?.metadata) return [];
  const candidates = [{ symbol: "USDT", assetId: "1984" }, { symbol: "USDC", assetId: "1337" }];
  const found = await Promise.all(candidates.map(async (candidate) => {
    const [details, metadata] = await Promise.all([api.query.assets.asset(candidate.assetId), api.query.assets.metadata(candidate.assetId)]);
    if (details.toJSON() === null) return null;
    const human = metadata.toHuman() as unknown as JsonObject;
    const symbol = String(human.symbol ?? "").toUpperCase();
    const decimals = Number(human.decimals);
    if (symbol !== candidate.symbol || !Number.isSafeInteger(decimals)) return null;
    return { ...candidate, decimals };
  }));
  return found.filter((asset): asset is ProposalAsset => asset !== null);
}

export async function getProposalCapabilities(network: ProposalNetwork): Promise<ProposalCapabilities> {
  const api = await connect(network);
  const specName = api.runtimeVersion.specName.toString();
  const assets = await queryKnownAssets(api).catch(() => []);
  const origins = parseTracks(api);
  return {
    runtime: { specName, specVersion: api.runtimeVersion.specVersion.toNumber() },
    origins,
    templates: templateCapabilities(api, assets, origins),
    assets,
  };
}

function assetSpend(api: ApiPromise, fields: Record<string, string>, assets: ProposalAsset[]) {
  if (!api.tx.treasury?.spend) throw new Error("This runtime does not support asset treasury spends");
  const assetId = required(fields, "assetId");
  const decimals = unsignedInteger(required(fields, "assetDecimals"), "Asset decimals");
  const asset = assets.find((item) => item.assetId === assetId && item.decimals === decimals);
  if (!asset) throw new Error("The selected asset could not be verified on Asset Hub");
  if (fields.symbol?.trim() && fields.symbol.trim().toUpperCase() !== asset.symbol) throw new Error("Asset symbol does not match its on-chain metadata");
  const amount = tokenAmountToPlanck(required(fields, "amount"), decimals);
  const validFrom = fields.validFrom?.trim() ? unsignedInteger(fields.validFrom, "Valid from block") : null;
  const beneficiaryType = api.tx.treasury.spend.meta.args[2]?.type.toString() ?? "";
  return api.tx.treasury.spend(assetKind(assetId), amount, assetBeneficiary(required(fields, "beneficiary"), beneficiaryType.includes("LocatableAccount")), validFrom);
}

function localSpend(api: ApiPromise, network: ProposalNetwork, fields: Record<string, string>) {
  if (!api.tx.treasury?.spendLocal) throw new Error("This runtime does not support local treasury spends");
  const amount = tokenAmountToPlanck(required(fields, "amount"), network.decimals);
  accountIdHex(required(fields, "beneficiary"));
  return api.tx.treasury.spendLocal(amount, fields.beneficiary.trim());
}

function parseBatch(fields: Record<string, string>) {
  let value: unknown;
  try { value = JSON.parse(required(fields, "spends")); } catch { throw new Error("Spends must be a valid JSON array"); }
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) throw new Error("Spends must contain between 1 and 20 payouts");
  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`Spend ${index + 1} is invalid`);
    const fields = Object.fromEntries(Object.entries(row).map(([key, item]) => [key, String(item ?? "")])) as Record<string, string>;
    return fields;
  });
}

const treasuryLimits: Record<string, Record<string, string>> = {
  [governanceChains.polkadot.genesisHash]: { small_tipper: "250", big_tipper: "1000", small_spender: "10000", medium_spender: "100000", big_spender: "1000000", treasurer: "10000000" },
  [governanceChains.kusama.genesisHash]: { small_tipper: "8.3333", big_tipper: "33.3333", small_spender: "333.3333", medium_spender: "3333.3333", big_spender: "33333.3333", treasurer: "333333.3333" },
  [governanceChains.paseo.genesisHash]: { small_tipper: "250", big_tipper: "1000", small_spender: "10000", medium_spender: "100000", big_spender: "1000000", treasurer: "10000000" },
};

function addFractions(left: Fraction, right: Fraction): Fraction {
  return { numerator: left.numerator * right.denominator + right.numerator * left.denominator, denominator: left.denominator * right.denominator };
}

function requestValue(network: ProposalNetwork, fields: Record<string, string>, asset = false): Fraction {
  if (!asset) return { numerator: tokenAmountToPlanck(required(fields, "amount"), network.decimals), denominator: BigInt(1) };
  const decimals = unsignedInteger(required(fields, "assetDecimals"), "Asset decimals");
  const amount = tokenAmountToPlanck(required(fields, "amount"), decimals);
  return { numerator: amount * BigInt(10) ** BigInt(network.decimals), denominator: BigInt(10) ** BigInt(decimals + 1) };
}

function treasuryRequestValue(network: ProposalNetwork, draft: ProposalDraft): Fraction | null {
  if (draft.template === "treasury") return requestValue(network, draft.fields);
  if (draft.template === "usdx-treasury" || draft.template === "multi-asset-bounty") return requestValue(network, draft.fields, true);
  if (draft.template !== "batch-treasury") return null;
  return parseBatch(draft.fields).reduce((total, spend) => addFractions(total, requestValue(network, spend, Boolean(spend.assetId?.trim()))), { numerator: BigInt(0), denominator: BigInt(1) });
}

function validateTreasuryOrigin(network: ProposalNetwork, draft: ProposalDraft, origin: string) {
  const request = treasuryRequestValue(network, draft);
  if (!request) return;
  const limit = treasuryLimits[network.genesisHash.toLowerCase()]?.[origin];
  if (!limit) throw new Error(`The ${origin} track cannot execute this treasury proposal`);
  const max = tokenAmountToPlanck(limit, network.decimals);
  if (request.numerator > max * request.denominator) throw new Error(`Requested value exceeds the ${origin} track limit of ${limit} ${network.symbol}`);
}

async function buildInnerProposal(api: ApiPromise, network: ProposalNetwork, draft: ProposalDraft, assets: ProposalAsset[]): Promise<InnerProposal> {
  const fields = draft.fields;
  let call;
  const extraPreimages: `0x${string}`[] = [];
  switch (draft.template) {
    case "treasury": call = localSpend(api, network, fields); break;
    case "usdx-treasury": call = assetSpend(api, fields, assets); break;
    case "batch-treasury": {
      if (!api.tx.utility?.batchAll) throw new Error("This runtime does not support atomic batched calls");
      const spends = parseBatch(fields).map((spend) => spend.assetId?.trim() ? assetSpend(api, spend, assets) : localSpend(api, network, spend));
      call = spends.length === 1 ? spends[0] : api.tx.utility.batchAll(spends);
      break;
    }
    case "multi-asset-bounty": {
      if (!api.tx.multiAssetBounties?.fundBounty) throw new Error("This runtime does not support funding multi-asset bounties");
      const curator = required(fields, "curator");
      accountIdHex(curator);
      const assetId = required(fields, "assetId");
      const decimals = unsignedInteger(required(fields, "assetDecimals"), "Asset decimals");
      const asset = assets.find((item) => item.assetId === assetId && item.decimals === decimals);
      if (!asset) throw new Error("The selected asset could not be verified on Asset Hub");
      if (fields.symbol?.trim() && fields.symbol.trim().toUpperCase() !== asset.symbol) throw new Error("Asset symbol does not match its on-chain metadata");
      const amount = tokenAmountToPlanck(required(fields, "amount"), decimals);
      let metadataHash: `0x${string}`;
      if (fields.description?.trim()) {
        const metadata = stringToHex(fields.description.trim()) as `0x${string}`;
        metadataHash = blake2AsHex(hexToU8a(metadata), 256) as `0x${string}`;
        extraPreimages.push(metadata);
      } else {
        metadataHash = hash32(required(fields, "metadataHash"), "Metadata hash");
        if (await registeredPreimageLength(api, metadataHash) === null) throw new Error("The metadata preimage is not registered on the selected chain");
      }
      call = api.tx.multiAssetBounties.fundBounty(assetKind(assetId), amount, curator, metadataHash);
      break;
    }
    case "remark": call = api.tx.system.remark(stringToHex(required(fields, "remark"))); break;
    case "cancel": {
      if (!api.tx.referenda?.cancel) throw new Error("This runtime does not support cancelling referenda");
      call = api.tx.referenda.cancel(unsignedInteger(required(fields, "referendumId"), "Referendum ID"));
      break;
    }
    case "kill": {
      if (!api.tx.referenda?.kill) throw new Error("This runtime does not support killing referenda");
      call = api.tx.referenda.kill(unsignedInteger(required(fields, "referendumId"), "Referendum ID"));
      break;
    }
    case "new-preimage": {
      const callHex = required(fields, "callHex");
      if (!isHex(callHex) || callHex.length < 6 || callHex.length % 2 !== 0) throw new Error("Call data must be valid hex");
      const decoded = api.createType("Call", callHex);
      if (decoded.toHex().toLowerCase() !== callHex.toLowerCase()) throw new Error("Call data must encode exactly one complete runtime call");
      const identified = decoded as unknown as { section?: string; method?: string };
      const method = identified.section && identified.method ? `${identified.section}.${identified.method}` : "Runtime call";
      return { method, callHex: decoded.toHex() as `0x${string}`, extraPreimages };
    }
    case "existing-preimage": throw new Error("Existing preimages do not contain call data");
    default: throw new Error("Unsupported proposal template");
  }
  return { method: `${call.method.section}.${call.method.method}`, callHex: call.method.toHex() as `0x${string}`, extraPreimages };
}

function statusLength(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const object = value as JsonObject;
  for (const key of ["len", "maybeLen"]) {
    if (object[key] !== undefined && object[key] !== null) {
      const len = Number(object[key]);
      if (Number.isSafeInteger(len)) return len;
    }
  }
  for (const item of Object.values(object)) {
    const len = statusLength(item);
    if (len !== null) return len;
  }
  return null;
}

export async function registeredPreimageLength(api: ApiPromise, hash: `0x${string}`) {
  const query = api.query.preimage.requestStatusFor ?? api.query.preimage.statusFor;
  if (!query) throw new Error("This runtime does not expose preimage status storage");
  const status = await query(hash);
  return statusLength(status.toJSON());
}

function governance(api: ApiPromise, network: ProposalNetwork, draft: ProposalDraft, assets: ProposalAsset[]) {
  if (!api.tx.referenda?.submit) throw new Error("This runtime does not support OpenGov proposals");
  const origin = parseTracks(api).find((item) => item.value === draft.origin);
  if (!origin) throw new Error("Select an origin exposed by this runtime");
  const capability = templateCapabilities(api, assets, parseTracks(api))[draft.template];
  if (!capability.allowedOrigins.includes(origin.value)) throw new Error(`${origin.label} cannot execute this proposal template`);
  validateTreasuryOrigin(network, draft, origin.value);
  const enactmentBlocks = unsignedInteger(draft.enactmentBlocks, "Enactment delay");
  return { origin: trackNameToOrigin(origin.value), enactment: { After: enactmentBlocks } };
}

async function proposalState(api: ApiPromise, network: ProposalNetwork, draft: ProposalDraft, assets: ProposalAsset[]) {
  const gov = governance(api, network, draft, assets);
  if (draft.template === "existing-preimage") {
    const hash = hash32(required(draft.fields, "hash"), "Preimage hash");
    const len = unsignedInteger(required(draft.fields, "len"), "Preimage length", false);
    const registered = await registeredPreimageLength(api, hash);
    if (registered === null) throw new Error("This preimage is not registered on the selected chain");
    if (registered !== len) throw new Error(`Preimage length is ${registered}, not ${len}`);
    return { method: "Registered preimage", callHex: "0x" as `0x${string}`, callHash: hash, callLength: len, preimageExists: true, extraPreimages: [] as `0x${string}`[], ...gov };
  }
  const inner = await buildInnerProposal(api, network, draft, assets);
  const bytes = hexToU8a(inner.callHex);
  const callHash = blake2AsHex(bytes, 256) as `0x${string}`;
  const callLength = bytes.length;
  const registered = await registeredPreimageLength(api, callHash);
  if (registered !== null && registered !== callLength) throw new Error("The registered preimage has an unexpected length");
  return { ...inner, callHash, callLength, preimageExists: registered === callLength, ...gov };
}

export async function prepareProposal(network: ProposalNetwork, draft: ProposalDraft): Promise<ProposalPreview> {
  const api = await connect(network);
  const assets = await queryKnownAssets(api).catch(() => []);
  const capability = templateCapabilities(api, assets, parseTracks(api))[draft.template];
  if (!capability.enabled) throw new Error(capability.reason);
  const state = await proposalState(api, network, draft, assets);
  const submit = api.tx.referenda.submit(state.origin, { Lookup: { hash: state.callHash, len: state.callLength } }, state.enactment);
  if (!state.preimageExists) api.tx.utility.batchAll([api.tx.preimage.notePreimage(state.callHex), submit]);
  return { method: state.method, callHex: state.callHex, callHash: state.callHash, callLength: state.callLength, preimageExists: state.preimageExists, submissionMethod: state.preimageExists ? "referenda.submit" : "utility.batchAll(preimage.notePreimage, referenda.submit)" };
}

function dispatchError(api: ApiPromise, error: { isModule: boolean; asModule: Parameters<ApiPromise["registry"]["findMetaError"]>[0]; toString: () => string }) {
  if (!error.isModule) return error.toString();
  const decoded = api.registry.findMetaError(error.asModule);
  return `${decoded.section}.${decoded.name}: ${decoded.docs.join(" ")}`;
}

export async function submitProposal({ network, draft, address, signer, onProgress }: { network: ProposalNetwork; draft: ProposalDraft; address: string; signer: Signer; onProgress?: (progress: ProposalProgress) => void }): Promise<ProposalResult> {
  accountIdHex(address);
  onProgress?.("Connecting to network");
  const api = await connect(network);
  onProgress?.("Validating proposal");
  const assets = await queryKnownAssets(api).catch(() => []);
  const capability = templateCapabilities(api, assets, parseTracks(api))[draft.template];
  if (!capability.enabled) throw new Error(capability.reason);
  const state = await proposalState(api, network, draft, assets);
  const submit = api.tx.referenda.submit(state.origin, { Lookup: { hash: state.callHash, len: state.callLength } }, state.enactment);
  const notes = [];
  for (const preimage of state.extraPreimages) {
    const hash = blake2AsHex(hexToU8a(preimage), 256) as `0x${string}`;
    if (await registeredPreimageLength(api, hash) === null) notes.push(api.tx.preimage.notePreimage(preimage));
  }
  if (!state.preimageExists) notes.push(api.tx.preimage.notePreimage(state.callHex));
  const extrinsic = notes.length ? api.tx.utility.batchAll([...notes, submit]) : submit;
  onProgress?.("Awaiting wallet signature");
  return await new Promise<ProposalResult>((resolve, reject) => {
    let unsubscribe: (() => void) | undefined;
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error?: Error, value?: ProposalResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe?.();
      if (error) reject(error); else resolve(value!);
    };
    timer = setTimeout(() => finish(new Error("Transaction confirmation timed out. Check the chain before retrying.")), 5 * 60_000);
    extrinsic.signAndSend(address, { signer }, (result) => {
      if (result.dispatchError) { finish(new Error(dispatchError(api, result.dispatchError))); return; }
      if (result.status.isInvalid || result.status.isDropped || result.status.isUsurped || result.status.isFinalityTimeout) {
        finish(new Error(`Transaction ${result.status.type.toLowerCase()}. Check the account and retry.`)); return;
      }
      if (result.status.isBroadcast) onProgress?.("Broadcasting");
      if (result.status.isInBlock) onProgress?.("In block");
      if (result.status.isFinalized) {
        const submitted = result.events.find(({ event }) => event.section === "referenda" && event.method === "Submitted");
        if (!submitted) { finish(new Error("Transaction finalized without a referenda.Submitted event")); return; }
        onProgress?.("Finalized");
        const referendumIndex = Number(submitted.event.data[0].toString());
        if (!Number.isSafeInteger(referendumIndex)) { finish(new Error("referenda.Submitted returned an invalid referendum index")); return; }
        finish(undefined, { txHash: result.txHash.toHex(), blockHash: result.status.asFinalized.toHex(), referendumIndex });
      }
    }).then((stop) => { unsubscribe = stop; if (settled) stop(); }).catch((error) => finish(new Error(errorMessage(error))));
  });
}
