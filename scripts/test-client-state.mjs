import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import React from "react";
import { act, create } from "react-test-renderer";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const env = { tally: [], votes: [], onChain: [], spends: [], changes: new Set(), app: {}, chain: { genesisHash: "0x01" }, requests: [] };
globalThis[Symbol.for("subgov.clientTest")] = env;
const deferred = () => { let resolve, reject; const promise = new Promise((done, fail) => { resolve = done; reject = fail; }); return { resolve, reject, promise }; };
const enqueue = (list, args) => { const task = deferred(); list.push({ ...task, args }); return task.promise; };
env.readTally = (args) => enqueue(env.tally, args);
env.readVotes = (args) => enqueue(env.votes, args);
env.readOnChain = (args) => enqueue(env.onChain, args);
env.readSpend = (args) => enqueue(env.spends, args);
env.discussionRequest = async (query, variables, options) => { env.requests.push({ query, variables, options }); return { ok: true }; };
const prefix = "const e=globalThis[Symbol.for('subgov.clientTest')];";
const mocks = {
  "@/components/app-state": `${prefix} export const useApp=()=>e.app;`,
  "@/components/ui": "export const MetaItem=()=>null,MetaList=()=>null,ModuleHeader=()=>null,Panel=()=>null; export const StatusBadge=({status})=>status;",
  "@/components/call-tree-view": "export const CallTreeView=()=>null;",
  "@/lib/call-chain": `${prefix} export const readReferendumOnChain=(a)=>e.readOnChain(a);`,
  "@/lib/call-tree": "export const callCount=()=>1;",
  "@/hooks/use-chain-href": `${prefix} export const useChain=()=>e.chain; export const useChainHref=()=>p=>p;`,
  "next/link": "export default ()=>null;",
  "@/components/tx-dialog": "export const TxDialog=()=>null;",
  "@/lib/treasury-chain": `${prefix} export const readSpend=(chain,index)=>e.readSpend({chain,index}); export const buildSpendAction=()=>null,readMultiAssetBounties=()=>null,readMultiAssetChildren=()=>null,readTreasuryOverview=()=>null;`,
  "@/lib/chain-api": "export const preconnectChainApi=()=>{};",
  "@/lib/chain-tally": `${prefix} export const readReferendumTally=(a)=>e.readTally(a); export const readAccountReferendumVotes=(a)=>e.readVotes(a);`,
  "@/lib/governance-sync": `${prefix} export const subscribeGovernanceChanged=(fn)=>{e.changes.add(fn);return ()=>e.changes.delete(fn)};`,
  "@/lib/discussion": `${prefix} export const discussionSpace='subgov'; export const discussionKeyType=(type,fallback)=>type??fallback; export const discussionRequest=(...args)=>e.discussionRequest(...args);`,
};
const root = new URL("../src/", import.meta.url);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mocks[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
    if (specifier.startsWith("@/")) return nextResolve(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    if (context.parentURL?.startsWith(root.href) && specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".tsx")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText };
    return nextLoad(url, context);
  },
});
const { useLiveReferendumTally } = await import("../src/hooks/use-live-referendum-tally.ts");
const { useDiscussionSession } = await import("../src/hooks/use-discussion-session.ts");
const { AppStateProvider, useApp } = await import("../src/components/app-state.tsx");
const { useReferendumOnChain } = await import("../src/components/referendum-onchain.tsx");
const { SpendStateProvider, SpendDetailStatus, SpendActions } = await import("../src/components/treasury-onchain.tsx");
hooks.deregister();

const storage = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
};
globalThis.localStorage = storage();
globalThis.sessionStorage = storage();
const intervals = new Set();
globalThis.window = Object.assign(new EventTarget(), { setTimeout, clearTimeout, setInterval: (fn) => { intervals.add(fn); return fn; }, clearInterval: (fn) => intervals.delete(fn) });
globalThis.document = Object.assign(new EventTarget(), { cookie: "" });
window.parent = window;

let latest;
function TallyProbe(props) { latest = useLiveReferendumTally(props); return null; }
const view = (n) => ({ aye: String(n), nay: "0", supportAmount: String(n), approval: 100 });
const props = { rpc: "mock", genesisHash: "0x01", referendumId: 1, trackId: 0, decimals: 10, initial: view(1), initialVotes: [], initialVoteCount: 100 };
let renderer;
await act(async () => { renderer = create(React.createElement(TallyProbe, props)); });
await act(async () => { env.tally.shift().resolve(view(10)); });
assert.equal(latest.tally.aye, "10");
await act(async () => { renderer.update(React.createElement(TallyProbe, { ...props, referendumId: 2, initial: view(2) })); });
assert.equal(latest.live, false);
assert.equal(latest.tally.aye, "2", "a different referendum must never display the old live tally while loading");
await act(async () => { for (const change of env.changes) change({ referendumId: 2, voter: "A" }); });
await act(async () => { renderer.update(React.createElement(TallyProbe, { ...props, referendumId: 2, genesisHash: "0x02", initial: view(3) })); });
await act(async () => {
  env.tally.shift().resolve(view(20));
  env.tally.shift().resolve(view(21));
  env.votes.shift().resolve([{ voter: "A", side: "Aye", amount: "1" }]);
});
assert.equal(latest.tally.aye, "3", "late responses from the previous chain must be ignored");
assert.deepEqual(latest.votes, []);
await act(async () => { env.tally.shift().resolve(view(30)); });
await act(async () => { for (const change of env.changes) change({ referendumId: 2, voter: "B" }); });
await act(async () => {
  env.tally.shift().resolve(null);
  env.votes.shift().resolve([{ voter: "B", side: "Aye", amount: "1" }]);
});
assert.equal(latest.live, false, "ended referenda must drop the old ongoing tally");
assert.equal(latest.voteCount, 100, "an off-page voter's update must not increase the indexed total");
await act(async () => { renderer.unmount(); });

// Reloading a watch-only account must show its current vote even before Subscan indexes it.
await act(async () => { renderer = create(React.createElement(TallyProbe, { ...props, voter: "A", initialVoteCount: 0 })); });
await act(async () => { env.tally.shift().resolve(view(10)); env.votes.shift().resolve([{ voter: "A", side: "Aye", amount: "12500000000", conviction: "2x" }]); });
assert.equal(latest.accountVotesLive, true);
assert.equal(latest.votes.length, 1);
assert.equal(latest.voteCount, 0);
await act(async () => { window.dispatchEvent(new Event("focus")); });
assert.equal(env.votes.length, 1, "focus must refresh the current vote as well as the tally");
await act(async () => { renderer.update(React.createElement(TallyProbe, { ...props, voter: "B" })); });
assert.equal(latest.accountVotesLive, false);
assert.deepEqual(latest.votes, []);
await act(async () => { env.tally.shift().resolve(view(11)); env.votes.shift().resolve([{ voter: "A", side: "Nay", amount: "1" }]); });
assert.deepEqual(latest.votes, [], "late responses for a previous account must be discarded");
await act(async () => { env.tally.shift().resolve(view(12)); env.votes.shift().resolve([]); });
assert.equal(latest.accountVotesLive, true);
await act(async () => { for (const change of env.changes) change({ referendumId: 1, voter: "A", extrinsicIndex: "100-1" }); });
assert.equal(env.votes[0].args.address, "B", "a previous account's finality event must refresh the current account");
assert.equal(env.votes[0].args.extrinsicIndex, undefined);
await act(async () => { env.tally.shift().resolve(view(13)); env.votes.shift().resolve([]); });
await act(async () => { renderer.unmount(); });

function OnChainProbe({ id }) { latest = useReferendumOnChain({ id, preimageHash: "0x123" }, false); return null; }
env.chain = { rpc: "mock", genesisHash: "0x01", decimals: 10 };
await act(async () => { renderer = create(React.createElement(OnChainProbe, { id: 1 })); });
assert.equal(env.onChain[0].args.decodeProposal, false, "status/deposits load without decoding a closed tab");
await act(async () => { env.onChain.shift().resolve({ fields: { status: "Deciding", decisionDeposit: "1" } }); });
assert.equal(latest.data.fields.decisionDeposit, "1");
await act(async () => { window.dispatchEvent(new Event("focus")); renderer.update(React.createElement(OnChainProbe, { id: 2 })); });
assert.equal(latest.data, null);
await act(async () => { env.onChain.shift().resolve({ fields: { status: "Approved" } }); });
assert.equal(latest.data, null, "previous referendum state cannot overwrite a new page");
await act(async () => { env.onChain.shift().resolve({ fields: { status: "Preparing", decisionDeposit: "0" } }); });
await act(async () => { for (const change of env.changes) change({ referendumId: 2 }); });
await act(async () => { env.onChain.shift().resolve({ fields: { status: "Deciding", decisionDeposit: "1" } }); });
assert.equal(latest.data.fields.decisionDeposit, "1", "finality refresh updates deposits");
assert.equal(intervals.size, 1);
await act(async () => { for (const refresh of intervals) refresh(); });
await act(async () => { env.onChain.shift().resolve({ fields: { status: "Deciding" }, now: 123, deciding: { since: 100, confirming: null } }); });
assert.equal(latest.data.now, 123, "decision progress refreshes while the tab remains focused");
await act(async () => { for (const refresh of intervals) refresh(); });
await act(async () => { env.onChain.shift().reject(new Error("RPC unavailable")); });
assert.equal(latest.data, null, "a failed refresh must not leave an old threshold advertised as current");
assert.equal(latest.error, "RPC unavailable");

await act(async () => { renderer.unmount(); });

assert.equal(intervals.size, 0, "unmount stops decision progress polling");

// The header and settlement action share one read and cannot leak a previous spend's delivery state.
const spendPage = (index) => React.createElement(SpendStateProvider, { index },
  React.createElement(SpendDetailStatus, { status: "Awarded" }), React.createElement(SpendActions, { index }));
await act(async () => { renderer = create(spendPage(287)); });
assert.equal(env.spends.length, 1, "header and actions must share their snapshot");
assert.match(JSON.stringify(renderer.toJSON()), /Payment initiated/);
const paid = { status: { attempted: { id: "0xffffffffffffffff" } }, assetKind: { v4: { location: { parents: 0, interior: { here: null } }, assetId: { parents: 1, interior: { here: null } } } }, beneficiary: { v4: { location: { parents: 0, interior: { here: null } }, accountId: { parents: 0, interior: { x1: [] } } } } };
await act(async () => { env.spends.shift().resolve({ spend: paid, now: 100 }); });
assert.match(JSON.stringify(renderer.toJSON()), /Paid · awaiting settlement/);
assert.match(JSON.stringify(renderer.toJSON()), /does not pay it again/);
await act(async () => { renderer.update(spendPage(288)); });
assert.doesNotMatch(JSON.stringify(renderer.toJSON()), /Paid · awaiting settlement/);
await act(async () => { env.spends.shift().resolve({ spend: { ...paid, status: { attempted: { id: 123 } } }, now: 101 }); });
assert.match(JSON.stringify(renderer.toJSON()), /Payment pending/);
assert.match(JSON.stringify(renderer.toJSON()), /delivery is not confirmed/);
await act(async () => { renderer.unmount(); });

function SessionProbe() { latest = useDiscussionSession(); return null; }
env.app = { signerAccount: "account", signer: { signRaw: async () => ({ signature: "test" }) }, walletSource: "talisman", readOnly: false };
sessionStorage.setItem("subgov:discussion:subgov:0x01:account", JSON.stringify({ token: "test-session", address: "account" }));
await act(async () => { renderer = create(React.createElement(SessionProbe)); });
assert.equal(latest.token, "test-session");
await latest.signed("mutation edit", {});
assert.equal(env.requests.length, 1);
const staleSigned = latest.signed;
env.app = { ...env.app, signer: null, walletSource: "watch", readOnly: true };
await act(async () => { renderer.update(React.createElement(SessionProbe)); });
assert.equal(latest.token, null);
await assert.rejects(latest.signed("mutation edit", {}), /signing wallet/);
await assert.rejects(staleSigned("mutation delete", {}), /signing wallet/);
assert.equal(env.requests.length, 1, "watch-only mode must not reuse a cached session to mutate comments");
env.app = { ...env.app, signer: { signRaw: async () => ({ signature: "test" }) }, walletSource: "talisman", readOnly: false };
env.chain = { genesisHash: "0x02" };
await act(async () => { renderer.update(React.createElement(SessionProbe)); });
assert.equal(latest.token, null, "DeGov sessions must be scoped to the chain");
await act(async () => { renderer.unmount(); });

const a = `0x${"11".repeat(32)}`, b = `0x${"22".repeat(32)}`, real = `0x${"33".repeat(32)}`;
window.injectedWeb3 = { test: { enable: async () => ({ accounts: { get: async () => [{ address: a }, { address: b }] }, signer: {} }) } };
const observed = [];
function WalletProbe() { latest = useApp(); observed.push({ account: latest.account, signer: latest.signerAccount, proxy: latest.proxyReal }); return null; }
await act(async () => { renderer = create(React.createElement(AppStateProvider, null, React.createElement(WalletProbe))); });
await act(async () => { await latest.connectInjected("test"); });
await act(async () => { latest.setProxyReal(real); });
assert.equal(latest.account, real);
const oldSetProxy = latest.setProxyReal;
observed.length = 0;
await act(async () => { latest.selectAccount(b); });
assert(observed.every((state) => state.signer !== b || state.proxy === null), "account switching must invalidate the proxy synchronously");
await act(async () => { oldSetProxy(real); });
assert.equal(latest.account, b, "a late proxy verification for a previous signer must not affect the active signer");
await act(async () => { latest.setProxyReal(real); });
observed.length = 0;
await act(async () => { await latest.disconnect(); });
assert(observed.every((state) => state.signer !== null || state.account === null), "disconnect must clear the effective account before effects run");
await act(async () => { renderer.unmount(); });
delete globalThis[Symbol.for("subgov.clientTest")];
console.log("client state: tally isolation, watch-only sessions and proxy account switching passed");
