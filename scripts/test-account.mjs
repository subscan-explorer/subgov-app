import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import {
  convictionLockPeriods,
  parseVotingExtras,
  parseReferendumOutcome,
  refundableDeposits,
  unlockPlan,
  voteBalance,
  voteUnlockAt,
} from "../src/lib/account-voting.ts";

const PAS = BigInt("10000000000");
const VLP = 100_800; // 7 days of 6 s blocks

// Referendum outcomes
assert.deepEqual(parseReferendumOutcome({ ongoing: { track: 0 } }), { state: "ongoing" });
assert.deepEqual(parseReferendumOutcome({ killed: 500 }), { state: "killed", end: 500 });
assert.deepEqual(parseReferendumOutcome(null), { state: "unknown" });
const approved = parseReferendumOutcome({ approved: [1000, { who: "alice", amount: "100" }, { who: "bob", amount: 2000 }] });
assert.equal(approved.state, "approved");
assert.equal(approved.end, 1000);
assert.deepEqual(approved.submissionDeposit, { who: "alice", amount: BigInt(100) });
assert.deepEqual(approved.decisionDeposit, { who: "bob", amount: BigInt(2000) });
const rejected = parseReferendumOutcome({ rejected: [2000, { who: "alice", amount: "100" }, null] });
assert.equal(rejected.decisionDeposit, null);
assert.equal(parseReferendumOutcome({ timedOut: [3000, null, null] }).state, "timedOut");

// Lock expiry follows remove_vote: only winning Standard votes keep conviction locks
assert.equal(convictionLockPeriods("Locked6x"), 32);
const aye3x = { mode: "Aye", conviction: "Locked3x", balance: 5n * PAS };
const nay1x = { mode: "Nay", conviction: "Locked1x", balance: PAS };
assert.equal(voteUnlockAt(aye3x, { state: "ongoing" }, VLP), null);
assert.equal(voteUnlockAt(aye3x, approved, VLP), 1000 + 4 * VLP);
assert.equal(voteUnlockAt(nay1x, approved, VLP), 0);
assert.equal(voteUnlockAt(nay1x, rejected, VLP), 2000 + VLP);
assert.equal(voteUnlockAt({ mode: "Split", aye: PAS, nay: PAS }, approved, VLP), 0);
assert.equal(voteUnlockAt(aye3x, { state: "cancelled", end: 7, submissionDeposit: null, decisionDeposit: null }, VLP), 0);
assert.equal(voteBalance({ mode: "Abstain", aye: 3n * PAS, nay: 4n * PAS, abstain: 2n * PAS }), 9n * PAS);

// Migrated Paseo outcomes can have historical end blocks above the current governance clock.
// None/losing/split/cancelled/killed/timed-out votes must still be immediately removable.
for (const state of ["cancelled", "killed", "timedOut"]) {
 const outcome = {state, end:8_056_029, submissionDeposit:null, decisionDeposit:null};
 const unlockAt = voteUnlockAt(aye3x, outcome, VLP);
 assert.equal(unlockAt,0);
 const migrated = unlockPlan([{trackId:0,lock:5n*PAS,prior:null,delegated:0n,votes:[{referendumId:99,vote:aye3x,outcome,unlockAt}]}],2_075_361);
 assert.equal(migrated.releasable,5n*PAS);
 assert.deepEqual(migrated.remove,[{trackId:0,referendumId:99}]);
}
assert.equal(voteUnlockAt({...aye3x,conviction:"None"},{...approved,end:8_000_000},VLP),0);
assert.equal(voteUnlockAt(nay1x,{...approved,end:8_000_000},VLP),0);
assert.equal(voteUnlockAt(aye3x,{state:"unknown"},VLP),null);

// Unlock plan
const plan = unlockPlan([
  {
    trackId: 32,
    lock: 9n * PAS,
    prior: null,
    delegated: 0n,
    votes: [
      { referendumId: 151, vote: { mode: "Abstain", aye: 3n * PAS, nay: 4n * PAS, abstain: 2n * PAS }, outcome: rejected, unlockAt: 2000 },
      { referendumId: 153, vote: nay1x, outcome: { state: "ongoing" }, unlockAt: null },
    ],
  },
  { trackId: 0, lock: 2n * PAS, prior: { unlockAt: 10_000, amount: 2n * PAS }, delegated: 0n, votes: [] },
], 5000);
assert.deepEqual(plan.remove, [{ trackId: 32, referendumId: 151 }]);
assert.deepEqual(plan.unlock, [32]);
assert.equal(plan.lockedBefore, 9n * PAS);
assert.equal(plan.lockedAfter, 2n * PAS);
assert.equal(plan.releasable, 7n * PAS);
// Nothing expired: no calls
const idle = unlockPlan([{ trackId: 1, lock: PAS, prior: null, delegated: 0n, votes: [{ referendumId: 1, vote: aye3x, outcome: approved, unlockAt: 9_999_999 }] }], 5000);
assert.deepEqual(idle.remove, []);
assert.deepEqual(idle.unlock, []);
assert.equal(idle.releasable, 0n);
// An expired prior alone is unlockable
const prior = unlockPlan([{ trackId: 2, lock: PAS, prior: { unlockAt: 10, amount: PAS }, delegated: 0n, votes: [] }], 5000);
assert.deepEqual(prior.unlock, [2]);

// Deposits
assert.deepEqual(refundableDeposits(approved, "alice"), [{ kind: "submission", amount: BigInt(100) }]);
assert.deepEqual(refundableDeposits(approved, "bob"), [{ kind: "decision", amount: BigInt(2000) }]);
assert.deepEqual(refundableDeposits(rejected, "alice"), []);
assert.deepEqual(refundableDeposits({ state: "ongoing" }, "alice"), []);

// A delegating account still has its prior lock and incoming voting power.
assert.deepEqual(parseVotingExtras({ casting: { votes: [], delegations: { votes: "30", capital: 20 }, prior: [123, "40"] } }), {
  prior: { unlockAt: 123, amount: BigInt(40) },
  delegations: { votes: BigInt(30), capital: BigInt(20) },
});
const delegating = parseVotingExtras({ delegating: { balance: 40, delegations: { votes: "30", capital: 20 }, prior: [6000, "100"] } });
assert.deepEqual(delegating.delegations, { votes: 30n, capital: 20n });
const delegatingTrack = { trackId: 3, lock: 100n, prior: delegating.prior, delegated: 40n, votes: [] };
assert.equal(unlockPlan([delegatingTrack], 5000).releasable, 0n);
assert.equal(unlockPlan([delegatingTrack], 6000).releasable, 60n);

const { addressOf, listOf, ratioPercent } = await import("../src/lib/payload.ts");
assert.deepEqual(listOf({ list: [1, 2] }), [1, 2]);
assert.deepEqual(listOf([3]), [3]);
assert.deepEqual(listOf(null), []);
assert.deepEqual(addressOf({ address: "5abc", people: { display: "Alice" } }), { address: "5abc", display: "Alice" });
assert.deepEqual(addressOf("5abc"), { address: "5abc" });
assert.equal(addressOf({}), null);
assert.equal(ratioPercent("0.64"), 64);
assert.equal(ratioPercent("64"), 64);
assert.equal(ratioPercent(""), null);
console.log("payload helpers ok");

const { packBubbles, bubbleBounds } = await import("../src/lib/bubble-pack.ts");
const bubbles = packBubbles([{ item: "a", weight: 100 }, { item: "b", weight: 25 }, { item: "c", weight: 25 }, { item: "z", weight: 0 }], 10, 1);
assert.equal(bubbles.length, 3);
assert.equal(bubbles[0].item, "a");
assert.equal(bubbles[0].r, 10);
assert.equal(bubbles[1].r, 5);
for (let i = 0; i < bubbles.length; i++) for (let j = i + 1; j < bubbles.length; j++) {
  assert.ok(Math.hypot(bubbles[i].x - bubbles[j].x, bubbles[i].y - bubbles[j].y) >= bubbles[i].r + bubbles[j].r);
}
assert.ok(bubbleBounds(bubbles)[2] > 20);

const { callTree, callCount, parseBoundedCall } = await import("../src/lib/call-tree.ts");
const leaf = (section, method, args) => ({ section, method, args, meta: { args: args.map((_, i) => ({ name: { toString: () => `a${i}` }, type: { toString: () => "u32" } })), docs: [{ toString: () => "Does a thing. More text." }] } });
const tree = callTree(leaf("utility", "batchAll", [[leaf("system", "remark", ["0x00"]), leaf("treasury", "spend", [1, 2])]]));
assert.equal(callCount(tree), 3);
assert.equal(tree.docs, "Does a thing.");
assert.equal(tree.args[0].calls.length, 2);
assert.equal(tree.args[0].calls[1].args[1].value, "2");
assert.deepEqual(parseBoundedCall({ lookup: { hash: "0x1", len: 5 } }), { hash: "0x1", len: 5 });
assert.deepEqual(parseBoundedCall({ inline: "0x0000" }), { inline: "0x0000" });
assert.equal(parseBoundedCall(null), null);
console.log("bubble and call tree helpers ok");

const { assetKindMeta, spendAction, spendStatusLabel, isLocallyPaid, nextSpendPeriod } = await import("../src/lib/asset-kind.ts");
const DOT_META = { symbol: "DOT", decimals: 10 };
const usdc = { v5: { location: { parents: 0, interior: { here: null } }, assetId: { parents: 0, interior: { x2: [{ palletInstance: 50 }, { generalIndex: 1337 }] } } } };
assert.deepEqual(assetKindMeta(usdc, DOT_META), { symbol: "Asset 1337 (base units)", decimals: 0, assetId: 1337 });
assert.deepEqual(assetKindMeta({ v4: { location: { parents: 0, interior: { here: null } }, assetId: { parents: 1, interior: { here: null } } } }, DOT_META), { symbol: "DOT", decimals: 10, assetId: null });
const foreignDot = { v5: { location: { parents: 0, interior: { here: null } }, assetId: { parents: 2, interior: { x1: [{ globalConsensus: { polkadot: null } }] } } } };
assert.deepEqual(assetKindMeta(foreignDot, { symbol: "KSM", decimals: 12 }), { symbol: "Unknown asset (base units)", decimals: 0, assetId: null });
assert.equal(spendAction(null, 10).action, null);
assert.equal(spendAction({ validFrom: 100, expireAt: 1000, status: "Pending" }, 50).action, null);
assert.equal(spendAction({ validFrom: 100, expireAt: 1000, status: "Pending" }, 150).action, "payout");
assert.equal(spendAction({ validFrom: 100, expireAt: 1000, status: { attempted: { id: 1 } } }, 150).action, "checkStatus");
assert.equal(spendAction({ validFrom: 100, expireAt: 1000, status: "Failed" }, 150).action, "payout");
assert.equal(spendAction({ validFrom: 100, expireAt: 1000, status: "pending" }, 1000).action, null);
assert.equal(spendAction({ validFrom: 100, expireAt: 1000, status: "pending" }, 1001).action, "checkStatus");
assert.equal(spendAction({ validFrom: 100, expireAt: 1000, status: { attempted: { id: 1 } } }, 1000).action, "checkStatus");
assert.deepEqual(nextSpendPeriod(33868800, 345600, 33988964), { at: 34214400, remaining: 225436, share: 1 - 225436 / 345600 });
assert.equal(nextSpendPeriod(100, 50, 260).at, 300);
for (const args of [[12_355_200,43_200,2_075_360],[0,0,20],[0,-1,20],[0,Infinity,20],[0,1,NaN]]) assert.equal(nextSpendPeriod(...args),null);
assert.equal(nextSpendPeriod(0,1,1_000_000_000).at,1_000_000_001);
console.log("treasury helpers ok");
const { cleanDescription } = await import("../src/lib/asset-kind.ts");
assert.equal(cleanDescription('{\n "title": "Moderation Team"}'), "Moderation Team");
assert.equal(cleanDescription("\u0005\u0000tSystem Collator Bounty"), "tSystem Collator Bounty");
assert.equal(cleanDescription(undefined), undefined);
assert.equal(cleanDescription("\ufffd\ufffd\u0013\u00004\ufffd^HNg,[8?+qZ1"),undefined);
console.log("description helper ok");
const calendar = await import("../src/lib/subscan-calendar.ts");
assert.equal(calendar.parseDay("2026-11-23"), "2026-11-23");
assert.equal(calendar.parseDay("2024-02-29"), "2024-02-29");
for (const day of [undefined, "2026-99-99", "2026-02-29", "2026-04-31", "garbage"]) assert.equal(calendar.parseDay(day), undefined);
{
  const grid = calendar.monthGrid(2026, 10); // November 2026 starts on a Sunday
  assert.equal(grid.weeks[0][0].day, "2026-10-26");
  assert.equal(grid.weeks[0][6].day, "2026-11-01");
  assert.ok(grid.weeks.every((week) => week.length === 7));
  assert.equal(grid.weeks.at(-1).at(-1).day, "2026-12-06");
  assert.equal(grid.start, Date.UTC(2026, 10, 1) / 1000);
  assert.deepEqual(calendar.parseMonth("2026-13", new Date(Date.UTC(2026, 1, 3))), { year: 2026, month: 1 });
  assert.deepEqual(calendar.parseMonth(undefined, new Date(Date.UTC(2026, 1, 3))), { year: 2026, month: 1 });
  assert.equal(calendar.monthKey(2026, 12), "2027-01");
  const days = calendar.eventsByDay([{ type: "bounty_expiry", time: 1764000000, bounty_id: 3 }, { type: "referendum_decision_end", time: 1763990000, referendum_index: 9 }, { type: "x", time: 0 }]);
  assert.equal([...days.values()].flat().length, 2);
  assert.equal(calendar.eventHref({ type: "bounty_expiry", time: 1, bounty_id: 3 }), "/treasury/bounties/3/");
  assert.equal(calendar.eventHref({ type: "referendum_enactment", time: 1, referendum_index: 9 }), "/referenda/9/");
  console.log("calendar helpers ok");
}
const lib = new URL("../src/lib/", import.meta.url);
const requestMock = Symbol.for("subgov.testGovernanceRequest");
const calls = [];
globalThis[requestMock] = async (chain, path, body) => {
  calls.push({ chain, path, body });
  return { code: 0, data: { count: 21, list: [{ referendum_index: 12, kind: "submission", refundable: true }] } };
};
const mocks = {
  "./chain-api": "export const getChainApi = () => { const api=globalThis[Symbol.for('subgov.testSnapshotApi')]; if(api)return api; throw Error('Unexpected chain connection'); };",
  "@/lib/network-server": "export const activeNetwork = async () => 'polkadot';",
  "@/lib/subscan-data": "export const liveReferendum = async () => null;",
  "@/lib/pubfi": "export const SUBSCAN_PAGE_SIZE = 20; export const subscan=(...args)=>globalThis[Symbol.for('subgov.testGovernanceRequest')](...args); export const governanceRequest = (...args) => globalThis[Symbol.for('subgov.testGovernanceRequest')](...args);",
};
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.startsWith(lib.href)) {
      if (mocks[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
      if (specifier.startsWith("@/lib/")) return nextResolve(new URL(`${specifier.slice(6)}.ts`, lib).href, context);
      if (specifier.startsWith("./") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const { buildDepositRefund } = await import("../src/lib/account-chain.ts");
const { buildUnnotePreimage, readReferendumOnChain } = await import("../src/lib/call-chain.ts");
const { readAssetMeta, buildSpendAction, readSpend } = await import("../src/lib/treasury-chain.ts");
const { accountDeposits } = await import("../src/lib/gov-actions.ts");
const { liveDelegateSupporters } = await import("../src/lib/subscan-governance.ts");
const { liveReferendumFields, withLiveReferendum } = await import("../src/lib/referendum-live.ts");
const {fellowshipReferendums,decodeFellowshipText}=await import("../src/lib/subscan-fellowship.ts");
hooks.deregister();

// The index can still say Preparing/0 PAS after placeDecisionDeposit finalized.
const chainFields = liveReferendumFields({ ongoing: { deciding: { since: 2065662, confirming: null }, submissionDeposit: { who: "alice", amount: 10n * PAS }, decisionDeposit: { who: "alice", amount: PAS } } }, 10);
assert.deepEqual(chainFields, { status: "Deciding", submissionDeposit: "10", decisionDeposit: "1" });
assert.deepEqual(withLiveReferendum({ status: "Preparing", decisionDeposit: "0", submissionDeposit: "10" }, chainFields), chainFields);
assert.equal(liveReferendumFields({ ongoing: { deciding: { since: 1, confirming: 100 } } }, 10).status, "Confirming");
assert.equal(liveReferendumFields({ ongoing: { deciding: null } }, 10).status, "Preparing");
assert.equal(liveReferendumFields({ rejected: [100, null, null] }, 10).decisionDeposit, "0");
assert.equal(liveReferendumFields(null, 10), null);
assert.equal(liveReferendumFields({ ongoing: null }, 10), null);
for (const status of ["Executed", "ExecutedFailed"]) assert.equal(withLiveReferendum({ status }, { ...chainFields, status: "Approved" }).status, status);

// Identical numeric IDs across chains are distinct assets; foreign locations are not native KSM.
const metadataApi = (symbol, decimals) => ({ query: {
  assets: { metadata: async (id) => { assert.equal(id, 1337); return { toJSON: () => ({ symbol, decimals }) }; } },
  foreignAssets: { metadata: async (location) => { assert.deepEqual(location, foreignDot.v5.assetId); return { toJSON: () => ({ symbol: "0x444f54", decimals: 10 }) }; } },
} });
assert.deepEqual(await readAssetMeta(metadataApi("USDC", 6), usdc, DOT_META), { symbol: "USDC", decimals: 6, assetId: 1337 });
assert.deepEqual(await readAssetMeta(metadataApi("TIP", 10), usdc, { symbol: "KSM", decimals: 12 }), { symbol: "TIP", decimals: 10, assetId: 1337 });
assert.deepEqual(await readAssetMeta(metadataApi("TIP", 10), foreignDot, { symbol: "KSM", decimals: 12 }), { symbol: "DOT", decimals: 10, assetId: null });
assert.match((await readAssetMeta(metadataApi("0x", 0), usdc, DOT_META)).symbol, /base units/);
const remote = { v5: { ...usdc.v5, location: { parents: 1, interior: { x1: [{ parachain: 2000 }] } } } };
assert.match((await readAssetMeta({ query: {} }, remote, DOT_META)).symbol, /Unknown asset/);
let spend = { validFrom: 100, expireAt: 1000, status: "Pending" };
let spendBlock = 150;
const spendApi = {
  query: { treasury: { spends: async () => ({ toJSON: () => spend }) }, parachainSystem: { lastRelayChainBlockNumber: async () => ({ toJSON: () => spendBlock }) } },
  tx: { treasury: { payout: (index) => ({ payout: index }), checkStatus: (index) => ({ checkStatus: index }) } },
};
assert.deepEqual(await buildSpendAction(spendApi, 7, "payout"), { payout: 7 });
spendBlock = 1000;
await assert.rejects(buildSpendAction(spendApi, 7, "payout"), /Spend status changed/);
await assert.rejects(buildSpendAction(spendApi, 7, "checkStatus"), /Spend status changed/);
spendBlock = 1001;
assert.deepEqual(await buildSpendAction(spendApi, 7, "checkStatus"), { checkStatus: 7 });
spend = null;
await assert.rejects(buildSpendAction(spendApi, 7, "payout"), /no longer stored/);

await liveDelegateSupporters("alice", "polkadot");
assert.deepEqual(calls.pop(), {
  chain: "polkadot",
  path: "scan/referenda/delegates",
  body: { account: "alice", page: 0, row: 20, is_delegator: true, is_active: true },
});
const page = await accountDeposits("polkadot", "alice", 1);
assert.deepEqual(calls.pop(), { chain: "polkadot", path: "scan/referenda/deposits", body: { account: "alice", page: 1, row: 20 } });
assert.equal(page.pageSize, 20);
assert.equal(page.count, 21);
assert.equal(page.rows[0]?.referendumId, 12);

const txCalls = [];
let chainOutcome = { approved: [1000, { who: "alice", amount: 100 }, { who: "bob", amount: 2000 }] };
const api = {
  query: { referenda: { referendumInfoFor: { multi: async (ids) => {
    assert.deepEqual(ids, [12]);
    return [{ toJSON: () => chainOutcome }];
  } } } },
  tx: { referenda: {
    refundSubmissionDeposit: (id) => txCalls.push(["submission", id]),
    refundDecisionDeposit: (id) => txCalls.push(["decision", id]),
  } },
};
await buildDepositRefund(api, 12, "submission", "alice");
await buildDepositRefund(api, 12, "decision");
await assert.rejects(buildDepositRefund(api, 12, "submission", "bob"), /does not belong/);
chainOutcome = { approved: [1000, null, null] };
await assert.rejects(buildDepositRefund(api, 12, "submission", "alice"), /no longer refundable/);
chainOutcome = { ongoing: { track: 0 } };
await assert.rejects(buildDepositRefund(api, 12, "decision", "bob"), /no longer refundable/);
assert.deepEqual(txCalls, [["submission", 12], ["decision", 12]]);
let preimageStatus = { unrequested: { ticket: ["alice", 100], len: 4 } };
const preimageApi = {
  query: { preimage: { requestStatusFor: async () => ({ toJSON: () => preimageStatus }) } },
  tx: { preimage: { unnotePreimage: (hash) => ({ hash }) } },
};
assert.deepEqual(await buildUnnotePreimage(preimageApi, "0x01", "alice"), { hash: "0x01" });
await assert.rejects(buildUnnotePreimage(preimageApi, "0x01", "bob"), /does not belong/);
preimageStatus = { requested: { maybeTicket: ["alice", 100], maybeLen: 4, count: 1 } };
assert.deepEqual(await buildUnnotePreimage(preimageApi, "0x01", "alice"), { hash: "0x01" });
preimageStatus = { requested: { maybeTicket: null, maybeLen: 4, count: 1 } };
await assert.rejects(buildUnnotePreimage(preimageApi, "0x01", "alice"), /no refundable deposit/);
preimageStatus = null;
await assert.rejects(buildUnnotePreimage(preimageApi, "0x01", "alice"), /no refundable deposit/);
preimageApi.query.preimage.statusFor = async () => ({ toJSON: () => ({ unrequested: { deposit: ["alice", 100], len: 4 } }) });
assert.deepEqual(await buildUnnotePreimage(preimageApi, "0x01", "alice"), { hash: "0x01" });
delete globalThis[requestMock];

console.log("account voting, delegations and refund tests passed");

// Keep raw track names in requests; decoded labels are presentation only.
const rawOrigin="0x66656c6c6f77730000";
assert.equal(decodeFellowshipText(rawOrigin),"fellows");
const savedRequest=globalThis[requestMock];
globalThis[requestMock]=async(chain,path,body)=>{assert.equal(chain,"collectives-polkadot");assert.equal(body.origin,rawOrigin);assert.equal(body.page,2);return {code:0,data:{count:251,list:[{referendum_index:679,origins_id:3}]}};};
assert.equal((await fellowshipReferendums("polkadot",2,{id:3,name:rawOrigin})).count,251);
globalThis[requestMock]=async()=>({code:0,data:{count:685,list:[{referendum_index:684,origins_id:12}]}});
await assert.rejects(fellowshipReferendums("polkadot",0,{id:3,name:rawOrigin}),/did not apply/);
assert.deepEqual(await fellowshipReferendums("paseo"),{rows:[],count:0});
globalThis[requestMock]=savedRequest;
console.log("fellowship raw-filter contract and mismatch guard passed");

const {listPage}=await import("../src/lib/list-page.ts");
for (const value of [undefined,"0","-1","1.5","NaN","Infinity","9007199254740993","oops",""]) assert.equal(listPage(value),0);
assert.equal(listPage("3"),2);

// LocalPay sentinel + local asset AND beneficiary establish delivery; XCM attempts do not.
const localSpend = { status: { attempted: { id: "0xffffffffffffffff" } }, assetKind: usdc, beneficiary: { v5: { location: { parents: 0, interior: { here: null } }, accountId: { parents: 0, interior: { x1: [{ accountId32: { id: "0x1234" } }] } } } } };
assert.equal(isLocallyPaid(localSpend), true);
assert.equal(isLocallyPaid({ ...localSpend, status: { attempted: { id: "18446744073709551615" } } }), true);
assert.equal(spendStatusLabel(localSpend, "Awarded"), "Paid · awaiting settlement");
assert.equal(spendAction(localSpend, 100).action, "checkStatus", "delivered local payments still need settlement");
assert.match(spendAction(localSpend, 100).note, /does not pay it again/);
for (const spend of [
  { ...localSpend, status: { attempted: { id: 123 } } },
  { ...localSpend, status: { attempted: { id: "123" } } },
  { ...localSpend, status: { attempted: { id: "invalid" } } },
  { ...localSpend, assetKind: { v5: { ...usdc.v5, location: { parents: 1, interior: { here: null } } } } },
  { ...localSpend, beneficiary: { v5: { ...localSpend.beneficiary.v5, location: { parents: 1, interior: { here: null } } } } },
  { ...localSpend, beneficiary: undefined },
]) {
  assert.equal(isLocallyPaid(spend), false);
  assert.equal(spendStatusLabel(spend, "Awarded"), "Payment pending");
  assert.equal(spendAction(spend, 100).action, "checkStatus");
  assert.match(spendAction(spend, 100).note, /delivery is not confirmed/);
}
assert.equal(spendStatusLabel(null, "Awarded"), "Payment initiated", "missing storage does not prove delivery");
assert.equal(spendStatusLabel(undefined, "Awarded"), "Payment initiated");
assert.equal(spendStatusLabel(null, "Paid"), "Paid");
assert.equal(spendStatusLabel({ status: "Failed" }, "Awarded"), "Payment failed");

// A moving best head must never mix the decision start and the governance clock.
const atHashes = [];
const finalSnapshot = { query: {
  referenda: { referendumInfoFor: async (id) => { assert.equal(id, 1970); return { toJSON: () => ({ ongoing: { deciding: { since: 33887751, confirming: null } } }) }; } },
  parachainSystem: { lastRelayChainBlockNumber: async () => ({ toJSON: () => 34040240 }) },
  system: { number: async () => { throw new Error("Must use the relay governance clock on Asset Hub"); } },
  treasury: { spends: async (id) => { assert.equal(id, 287); return { toJSON: () => localSpend }; } },
} };
globalThis[Symbol.for('subgov.testSnapshotApi')] = {
  rpc: { chain: { getFinalizedHead: async () => "0xfinalized" } },
  at: async (hash) => { atHashes.push(hash); return finalSnapshot; },
  query: new Proxy({}, { get: () => { throw new Error("Unexpected best-head read"); } }),
};
const finalRef = await readReferendumOnChain({ rpc: "mock", genesisHash: "0x01", id: 1970, decimals: 10, decodeProposal: false });
assert.deepEqual(finalRef.deciding, { since: 33887751, confirming: null });
assert.equal(finalRef.now, 34040240);
// Use a native local asset so the metadata path needs no moving-head query either.
localSpend.assetKind = { v5: { location: { parents: 0, interior: { here: null } }, assetId: { parents: 1, interior: { here: null } } } };
const finalSpend = await readSpend({ rpc: "mock", genesisHash: "0x01", symbol: "DOT", decimals: 10 }, 287);
assert.equal(finalSpend.now, 34040240);
assert.equal(isLocallyPaid(finalSpend.spend), true, "the read path must preserve the local payout proof");
assert.deepEqual(atHashes, ["0xfinalized", "0xfinalized"]);
finalSnapshot.query.referenda.referendumInfoFor = async () => ({ toJSON: () => ({ ongoing: { deciding: { since: 33887751, confirming: null }, proposal: { lookup: { hash: "0x01", len: 58 } } } }) });
const failedPreimage = await readReferendumOnChain({ rpc: "mock", genesisHash: "0x01", id: 1970, decimals: 10 });
assert.equal(failedPreimage.proposal.status, "missing");
assert.equal(failedPreimage.now, 34040240, "A proposal decode failure must preserve the decision clock");
assert.equal(failedPreimage.deciding.since, 33887751);
delete globalThis[Symbol.for('subgov.testSnapshotApi')];
console.log("finalized referendum and payment snapshots passed");
