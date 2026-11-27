import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { spendHistoryPage, relaySpendSource, isRelaySpend } from "../src/lib/treasury-history.ts";
import { callTree } from "../src/lib/call-tree.ts";
import { proposalSpends, proposalBeneficiary, spendBaseUnits, exactSpendAmount } from "../src/lib/proposal-spends.ts";
import { assetKindMeta } from "../src/lib/asset-kind.ts";
import { subsquareUrl } from "../src/lib/governance-source.ts";

const records = (start, end) => Array.from({ length: start - end + 1 }, (_, n) => ({ proposal_id: start - n }));
const fixture = { "assethub-polkadot": records(287, 203), polkadot: records(202, 0), "assethub-kusama": records(26, 9), kusama: records(8, 0), "assethub-paseo": [] };
let calls = [];
const read = async (source, page, row) => { calls.push([source, page, row]); return { count: fixture[source].length, rows: fixture[source].slice(page * row, (page + 1) * row) }; };
const all = [];
for (let page = 0; page < 15; page++) {
  calls = [];
  const result = await spendHistoryPage(read, "assethub-polkadot", "polkadot", { page });
  assert.equal(result.count, 288);
  assert(calls.length <= 5, "Pagination must not enumerate all history");
  all.push(...result.rows);
}
assert.deepEqual(all.map((r) => r.proposal_id), records(287, 0).map((r) => r.proposal_id));
assert(all.slice(0, 85).every((r) => !isRelaySpend(r)));
assert(all.slice(85).every(isRelaySpend));
const kusama = await spendHistoryPage(read, "assethub-kusama", "kusama");
assert.equal(kusama.count, 27);
assert.deepEqual(kusama.rows.map((r) => r.proposal_id), records(26, 7).map((r) => r.proposal_id));
assert.equal((await spendHistoryPage(read, "assethub-polkadot", "polkadot", { source: "relay" })).count, 203);
assert.equal((await spendHistoryPage(read, "assethub-polkadot", "polkadot", { source: "current" })).count, 85);
assert.equal((await spendHistoryPage(read, "assethub-paseo", null)).count, 0);
assert.deepEqual((await spendHistoryPage(read, "assethub-polkadot", "polkadot", { page: 999 })).rows, []);
assert.equal(relaySpendSource("paseo"), null);
const overlap = async (source, page, row) => ({ count: 1, rows: page === 0 && row > 0 ? [{ proposal_id: 1 }] : [] });
await assert.rejects(spendHistoryPage(overlap, "assethub-polkadot", "polkadot"), /overlap/);
await assert.rejects(spendHistoryPage(async (source, ...args) => { if (source === "polkadot") throw new Error("offline"); return read(source, ...args); }, "assethub-polkadot", "polkadot"), /offline/);
await assert.rejects(spendHistoryPage(async () => ({ count: 100, rows: [] }), "assethub-paseo", null), /Incomplete/);

const localAsset = { v5: { location: { parents: 0, interior: { here: null } }, assetId: { parents: 0, interior: { x2: [{ palletInstance: 50 }, { generalIndex: 1984 }] } } } };
const beneficiary = { v5: { location: { parents: 0, interior: { here: null } }, accountId: { parents: 0, interior: { x1: [{ accountId32: { id: `0x${"11".repeat(32)}`, network: null } }] } } } };
const call = (method, values) => ({ section: "treasury", method, meta: { args: Object.keys(values).map((name) => ({ name, type: "codec" })) }, args: Object.values(values).map((value) => ({ toJSON: () => value, toHuman: () => "rounded display only" })) });
const first = call("spend", { asset_kind: localAsset, amount: "0x05d21dba00", beneficiary });
const second = call("spendLocal", { amount: "1000000000001", beneficiary: { id: "alice" } });
const tree = callTree({ section: "utility", method: "batchAll", args: [[first, second]] });
const requests = proposalSpends(tree);
assert.equal(requests.length, 2);
assert.equal(requests[0].amount, "25000000000");
assert.equal(requests[0].native, false);
assert.equal(requests[1].native, true);
assert.equal(exactSpendAmount(requests[0].amount, 6), "25,000");
assert.equal(exactSpendAmount(requests[1].amount, 12), "1.000000000001");
assert.equal(proposalBeneficiary(beneficiary), `0x${"11".repeat(32)}`);
assert.equal(proposalBeneficiary({ v4: { parents: 1, interior: { here: null } } }), null);
assert.equal(spendBaseUnits("25,000"), null);
assert.equal(spendBaseUnits(Number.MAX_SAFE_INTEGER + 1), null);
const remote = { v5: { ...localAsset.v5, location: { parents: 1, interior: { here: null } } } };
assert.equal(assetKindMeta(remote, { symbol: "DOT", decimals: 10 }).symbol, "Unknown asset (base units)");
assert.equal(subsquareUrl("polkadot", "fellowship_referendums", 687), "https://collectives.subsquare.io/fellowship/referenda/687");
assert.equal(subsquareUrl("paseo", "treasury_spend", 1), undefined);

// The server adapter must fall back only on a missing record, never hide a provider failure.
const root = new URL("../src/", import.meta.url);
globalThis.__spendRead = async () => { throw new Error("No mock response"); };
registerHooks({ resolve(specifier, context, next) {
  if (specifier === "@/lib/pubfi") return { url: `data:text/javascript,${encodeURIComponent('export const SUBSCAN_PAGE_SIZE=20; export const subscan=(...args)=>globalThis.__spendRead(...args); export const governanceRequest=subscan;')}`, shortCircuit: true };
  if (specifier === "@/lib/network-server") return { url: 'data:text/javascript,export const activeNetwork=async()=>"polkadot";', shortCircuit: true };
  if (specifier === "@/lib/tokens") return { url: 'data:text/javascript,export const formatRowBalance=()=>""; export const tokenFromRow=()=>({});', shortCircuit: true };
  if (specifier.startsWith("@/")) return next(new URL(`${specifier.slice(2)}.ts`, root).href, context);
  return next(specifier, context);
} });
const { treasuryLive } = await import("../src/lib/subscan-treasury.ts");
calls = [];
globalThis.__spendRead = async (source, _path, body) => {
  calls.push(source);
  return source === "polkadot" ? { code: 0, data: { info: { proposal_id: body.proposal_id } } } : { code: 10004 };
};
assert.equal((await treasuryLive.spend(0, "polkadot")).sourceNetwork, "polkadot");
assert.deepEqual(calls, ["assethub-polkadot", "polkadot"]);
calls = [];
await treasuryLive.spend(0, "polkadot", "relay");
assert.deepEqual(calls, ["polkadot"]);
globalThis.__spendRead = async () => ({ code: 10004 });
assert.equal(await treasuryLive.spend(9999, "polkadot"), undefined);
globalThis.__spendRead = async () => ({ code: 401, message: "Unauthorized" });
await assert.rejects(treasuryLive.spend(0, "polkadot"), /Unauthorized/);
console.log("Treasury history pagination, source routing and exact proposal payment summaries passed");
