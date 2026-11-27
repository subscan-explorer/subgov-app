import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";

const pnpm = new URL("../node_modules/.pnpm/", import.meta.url);
const jitiPackage = (await readdir(pnpm)).find((name) => name.startsWith("jiti@"));
assert(jitiPackage, "jiti is required by the installed Next.js toolchain");
const { createJiti } = await import(new URL(`${jitiPackage}/node_modules/jiti/lib/jiti.mjs`, pnpm));
const jiti = createJiti(import.meta.url);
const { getProposalCapabilities, prepareProposal, registeredPreimageLength } = await jiti.import("../src/lib/proposal.ts");
const { disconnectChainApis } = await jiti.import("../src/lib/chain-api.ts");

let requestQueries = 0;
let legacyQueries = 0;
const preferred = await registeredPreimageLength({ query: { preimage: {
  requestStatusFor: async () => { requestQueries++; return { toJSON: () => ({ requested: { maybeTicket: null, count: 1, maybeLen: 42 } }) }; },
  statusFor: async () => ({ toJSON: () => { legacyQueries++; return { unrequested: { len: 7 } }; } }),
} } }, "0x00");
assert.equal(preferred, 42);
assert.equal(requestQueries, 1);
assert.equal(legacyQueries, 0, "requestStatusFor must take precedence over legacy statusFor");
const legacy = await registeredPreimageLength({ query: { preimage: {
  statusFor: async () => ({ toJSON: () => ({ unrequested: { deposit: null, len: 7 } }) }),
} } }, "0x00");
assert.equal(legacy, 7);

const network = {
  rpc: "wss://asset-hub-paseo-rpc.n.dwellir.com",
  genesisHash: "0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2",
  decimals: 10,
  symbol: "PAS",
};
const capabilities = await getProposalCapabilities(network);
assert.equal(capabilities.runtime.specName, "asset-hub-paseo");
assert.equal(capabilities.origins.find(({ value }) => value === "root")?.minEnactmentBlocks, 14_400);
assert(capabilities.assets.some(({ symbol, assetId, decimals }) => symbol === "USDT" && assetId === "1984" && decimals === 6));
assert.equal(capabilities.templates["multi-asset-bounty"].enabled, true);
assert.deepEqual(capabilities.templates.cancel.allowedOrigins, ["referendum_canceller"]);
assert.deepEqual(capabilities.templates.kill.allowedOrigins, ["referendum_killer"]);
assert(!capabilities.templates.treasury.allowedOrigins.includes("wish_for_change"));

const preview = await prepareProposal(network, {
  template: "remark",
  fields: { remark: "SubGov proposal self-check" },
  origin: "root",
  enactmentBlocks: "0",
});
assert.equal(preview.method, "system.remark");
assert.match(preview.callHash, /^0x[0-9a-f]{64}$/);
assert(preview.callLength > 2);

const address = "5EsQtXuXsVkZtLPiT3kwY68YjQ69cW5rAiLfDF2wYgjnE2UC";
const batch = await prepareProposal(network, {
  template: "batch-treasury",
  fields: { spends: JSON.stringify([{ amount: "1", beneficiary: address }, { amount: "2", beneficiary: address }]) },
  origin: "small_tipper",
  enactmentBlocks: "0",
});
assert.equal(batch.method, "utility.batchAll");
// Encode every enabled template against current runtime metadata, without signing.
const asset = capabilities.assets.find(({ symbol }) => symbol === "USDC") ?? capabilities.assets[0];
const assetFields = { assetId: asset.assetId, assetDecimals: String(asset.decimals), symbol: asset.symbol, amount: "1", beneficiary: address };
const drafts = [
  ["treasury", { amount: "1", beneficiary: address }, "treasury.spendLocal"],
  ["usdx-treasury", assetFields, "treasury.spend"],
  ["multi-asset-bounty", { ...assetFields, curator: address, description: "Unsigned SubGov test fixture" }, "multiAssetBounties.fundBounty"],
  ["cancel", { referendumId: "0" }, "referenda.cancel"],
  ["kill", { referendumId: "0" }, "referenda.kill"],
  ["new-preimage", { callHex: preview.callHex }, "system.remark"],
];
for (const [template, fields, method] of drafts) {
  const capability = capabilities.templates[template];
  if (!capability.enabled) { console.log(`unavailable template: ${template}`); continue; }
  const result = await prepareProposal(network, { template, fields, origin: capability.allowedOrigins[0], enactmentBlocks: "0" });
  assert.equal(result.method, method);
  assert(result.callLength > 2);
  console.log(`prepared ${template}: ${method}`);
}
if (process.env.SUBGOV_TEST_PREIMAGE_HASH && process.env.SUBGOV_TEST_PREIMAGE_LENGTH) {
  const existing = await prepareProposal(network, { template: "existing-preimage", fields: { hash: process.env.SUBGOV_TEST_PREIMAGE_HASH, len: process.env.SUBGOV_TEST_PREIMAGE_LENGTH }, origin: "small_tipper", enactmentBlocks: "0" });
  assert.equal(existing.preimageExists, true);
  assert.equal(existing.callLength, Number(process.env.SUBGOV_TEST_PREIMAGE_LENGTH));
  console.log("prepared existing-preimage: verified registered bytes");
} else console.log("existing-preimage live check skipped: supply a known test hash and length");
await assert.rejects(() => prepareProposal(network, {
  template: "treasury",
  fields: { amount: "1", beneficiary: address },
  origin: "wish_for_change",
  enactmentBlocks: "0",
}), /cannot execute this proposal template/);
await assert.rejects(() => prepareProposal(network, {
  template: "treasury",
  fields: { amount: "251", beneficiary: address },
  origin: "small_tipper",
  enactmentBlocks: "0",
}), /exceeds the small_tipper track limit/);
// Invalid inputs must fail before any signing request; these are read-only runtime checks.
const validNative = { template: "treasury", fields: { amount: "1", beneficiary: address }, origin: "small_tipper", enactmentBlocks: "10" };
const invalid = [
  ...["", "0", "-1", "1.00000000001", "NaN", "Infinity"].map(amount => [`native amount ${amount}`, { ...validNative, fields: { ...validNative.fields, amount } }]),
  ["invalid beneficiary", { ...validNative, fields: { amount: "1", beneficiary: "invalid-address" } }],
  ...["-1", "1.5", "9007199254740993"].map(enactmentBlocks => ["enactment " + enactmentBlocks, { ...validNative, enactmentBlocks }]),
  ["unknown origin", { ...validNative, origin: "not_a_track" }],
  ...["[]", "{}", "invalid", JSON.stringify(Array(21).fill(validNative.fields))].map(spends => ["invalid batch", { ...validNative, template: "batch-treasury", fields: { spends } }]),
  ...["-1", "1.5", "9007199254740993"].map(referendumId => ["invalid cancel id", { template: "cancel", fields: { referendumId }, origin: "referendum_canceller", enactmentBlocks: "100" }]),
  ...[{ assetId: "999999" }, { assetDecimals: "5" }, { symbol: "WRONG" }, { validFrom: "-1" }, { amount: "0.0000001" }].map(overrides => ["invalid asset metadata or amount", { ...validNative, template: "usdx-treasury", fields: { ...assetFields, ...overrides } }]),
  ["empty remark", { ...validNative, template: "remark", fields: { remark: " " }, origin: "root" }],
  ...["0xzz", "0x00", "0x000", preview.callHex + "00"].map(callHex => ["invalid call bytes", { ...validNative, template: "new-preimage", fields: { callHex }, origin: "root" }]),
  ["short preimage hash", { ...validNative, template: "existing-preimage", fields: { hash: "0x1234", len: "39" } }],
  ["missing preimage", { ...validNative, template: "existing-preimage", fields: { hash: "0x" + "00".repeat(32), len: "39" } }],
];
if (process.env.SUBGOV_TEST_PREIMAGE_HASH) invalid.push(["mismatched preimage length", { ...validNative, template: "existing-preimage", fields: { hash: process.env.SUBGOV_TEST_PREIMAGE_HASH, len: "40" } }]);
for (const [label, draft] of invalid) await assert.rejects(() => prepareProposal(network, draft), undefined, label);
console.log(`rejected ${invalid.length} invalid proposal drafts before signing`);
await disconnectChainApis();
console.log("proposal helpers ok");
