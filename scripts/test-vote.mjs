import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import { verifyConvictionReceipt, waitForConvictionFinality } from "../src/lib/conviction-finality.ts";
import {
  buildConvictionVote,
  classLock,
  confirmDelegationChange,
  convictionVoteBalance,
  decodeVoteByte,
  delegationChangePlan,
  convictionMultiplier,
  markSplitVotes,
  parseAccountVote,
  parseTrackVoting,
  parseVoteAmount,
  votableBalance,
  voteVotingPower,
  votesInExtrinsic,
} from "../src/lib/conviction-voting.ts";

const DOT = 10;
const KSM = 12;
const PAS = BigInt("10000000000"); // 1 PAS, 10 decimals

// Amounts
assert.equal(parseVoteAmount("1.25", DOT), BigInt("12500000000"));
assert.equal(parseVoteAmount("1", KSM), BigInt("1000000000000"));
assert.equal(parseVoteAmount("", DOT, "Aye amount", true), BigInt(0));
assert.equal(parseVoteAmount("0", DOT, "Aye amount", true), BigInt(0));
assert.throws(() => parseVoteAmount("0", DOT), /greater than zero/);
assert.throws(() => parseVoteAmount("-1", DOT), /valid positive amount/);
assert.throws(() => parseVoteAmount("0.00000000001", DOT), /at most 10 decimal places/);

// Standard aye / nay
assert.deepEqual(buildConvictionVote("Aye", { amount: "2" }, DOT, "Locked3x"), {
  Standard: { vote: { aye: true, conviction: "Locked3x" }, balance: BigInt("20000000000") },
});
assert.equal(buildConvictionVote("Nay", { amount: "2" }, DOT, "None").Standard.vote.aye, false);

// Split
const split = buildConvictionVote("Split", { aye: "1", nay: "0.5" }, DOT, "Locked6x");
assert.deepEqual(split, { Split: { aye: BigInt("10000000000"), nay: BigInt("5000000000") } });
assert.equal(convictionVoteBalance(split), BigInt("15000000000"));
assert.deepEqual(buildConvictionVote("Split", { aye: "1" }, DOT, "None"), { Split: { aye: BigInt("10000000000"), nay: BigInt(0) } });
assert.throws(() => buildConvictionVote("Split", { aye: "", nay: "0" }, DOT, "None"), /aye or nay amount/);

// SplitAbstain: every part independent, abstain required
const abstain = buildConvictionVote("Abstain", { abstain: "3", aye: "1", nay: "2" }, KSM, "None");
assert.deepEqual(abstain, { SplitAbstain: { aye: BigInt("1000000000000"), nay: BigInt("2000000000000"), abstain: BigInt("3000000000000") } });
assert.equal(convictionVoteBalance(abstain), BigInt("6000000000000"));
assert.deepEqual(buildConvictionVote("Abstain", { abstain: "1" }, DOT, "None"), { SplitAbstain: { aye: BigInt(0), nay: BigInt(0), abstain: BigInt("10000000000") } });
assert.throws(() => buildConvictionVote("Abstain", { aye: "1" }, DOT, "None"), /Abstain amount/);

// Packed vote byte
assert.deepEqual(decodeVoteByte("0x81"), { aye: true, conviction: "Locked1x" });
assert.deepEqual(decodeVoteByte(6), { aye: false, conviction: "Locked6x" });
assert.deepEqual(decodeVoteByte(128), { aye: true, conviction: "None" });
assert.deepEqual(decodeVoteByte({ vote: "Nay", conviction: "Locked2x" }), { aye: false, conviction: "Locked2x" });

// AccountVote JSON from convictionVoting.votingFor
assert.deepEqual(parseAccountVote({ standard: { vote: "0x83", balance: "0x00000000000000000000000ba43b7400" } }), {
  mode: "Aye", conviction: "Locked3x", balance: BigInt("50000000000"),
});
assert.deepEqual(parseAccountVote({ split: { aye: 10, nay: "20" } }), { mode: "Split", aye: BigInt(10), nay: BigInt(20) });
assert.deepEqual(parseAccountVote({ splitAbstain: { aye: 0, nay: 0, abstain: 7 } }), { mode: "Abstain", aye: BigInt(0), nay: BigInt(0), abstain: BigInt(7) });
assert.equal(parseAccountVote({}), null);

const casting = parseTrackVoting({
  casting: {
    votes: [[12, { standard: { vote: 2, balance: 100 } }], [15, { split: { aye: 1, nay: 2 } }]],
    delegations: { votes: 0, capital: 0 },
    prior: [0, 0],
  },
});
assert.equal(casting.kind, "casting");
assert.deepEqual(casting.votes.get(12), { mode: "Nay", conviction: "Locked2x", balance: BigInt(100) });
assert.equal(casting.votes.get(15)?.mode, "Split");
assert.equal(casting.votes.get(99), undefined);

const delegating = parseTrackVoting({ delegating: { balance: "0x64", target: "5Target", conviction: "Locked4x", delegations: {}, prior: [0, 0] } });
assert.deepEqual(delegating, { kind: "delegating", target: "5Target", conviction: "Locked4x", balance: BigInt(100) });
assert.deepEqual(parseTrackVoting(null), { kind: "casting", votes: new Map() });
assert.equal(confirmDelegationChange(casting, null), false);
assert.equal(confirmDelegationChange(delegating, delegating), true);
assert.throws(() => confirmDelegationChange(delegating, null), /changed/);
assert.throws(() => confirmDelegationChange(casting, delegating), /changed/);
for (const change of [{ target: "5Other" }, { conviction: "Locked6x" }, { balance: 99n }]) {
  assert.throws(() => confirmDelegationChange(delegating, { ...delegating, ...change }), /changed/);
}

// Balance and locks
assert.equal(votableBalance({ nonce: 1, data: { free: "0x3e8", reserved: 24, frozen: 500, flags: "0x0" } }), BigInt(1024));
assert.equal(votableBalance(null), BigInt(0));
assert.equal(classLock([[0, 5], [33, "0x10"]], 33), BigInt(16));
assert.equal(classLock([[0, 5]], 2), BigInt(0));

// Undelegate / change delegation plans
assert.deepEqual(delegationChangePlan([33]), [{ call: "undelegate", trackId: 33 }]);
assert.deepEqual(delegationChangePlan([34, 2, 34]), [{ call: "undelegate", trackId: 2 }, { call: "undelegate", trackId: 34 }]);
assert.deepEqual(delegationChangePlan([1], { trackId: 1 }), [{ call: "undelegate", trackId: 1 }, { call: "delegate", trackId: 1 }]);
assert.throws(() => delegationChangePlan([]), /at least one track/);
assert.throws(() => delegationChangePlan([-1]), /valid OpenGov track/);

// Batch extrinsic params preserve the original variant even for a single row.
const splitRow = { voter: "A", side: "Aye", amount: "10", conviction: "0.1x", at: "t1", extrinsicIndex: "10-2" };
const voteParams = (referendumId, vote) => [
  { name: "poll_index", value: referendumId },
  { name: "vote", value: vote },
];
const splitBallot = { Split: { aye: "10", nay: "20" } };
const oneSided = votesInExtrinsic(voteParams(151, { Split: { aye: "10", nay: "0" } }), 151);
assert.equal(markSplitVotes([splitRow], () => oneSided)[0].split, "Split");

const otherBallot = { SplitAbstain: { aye: "10", nay: "20", abstain: "30" } };
const batched = votesInExtrinsic([{
  name: "call",
  value: { call_module: "Utility", call_name: "batch", params: [{
    name: "calls",
    value: [
      { call_module: "ConvictionVoting", call_name: "vote", params: voteParams(151, splitBallot) },
      { call_module: "ConvictionVoting", call_name: "vote", params: voteParams(152, otherBallot) },
    ],
  }] },
}], 151);
assert.deepEqual(batched, [{ mode: "Split", aye: 10n, nay: 20n }]);
assert.equal(markSplitVotes([splitRow], () => batched)[0].split, "Split");
const nayRow = { ...splitRow, side: "Nay", amount: "20" };
assert.equal(markSplitVotes([nayRow], () => batched)[0].split, "Split");

const abstainBallot = votesInExtrinsic(voteParams(151, otherBallot), 151);
assert.equal(markSplitVotes([nayRow], () => abstainBallot)[0].split, "SplitAbstain");
const standard = votesInExtrinsic(voteParams(151, { Standard: { vote: 128, balance: "10" } }), 151);
assert.equal(markSplitVotes([splitRow], () => standard)[0].split, undefined);
assert.equal(markSplitVotes([splitRow], () => [...oneSided, ...standard])[0].split, undefined);
assert.equal(markSplitVotes([{ ...splitRow, delegated: true }], () => oneSided)[0].split, undefined);

const missing = () => undefined;
assert.deepEqual(markSplitVotes([splitRow, nayRow], missing).map(({ split }) => split), ["Split", "Split"]);
const otherChain = { ...nayRow, relayChain: true };
assert.deepEqual(markSplitVotes([splitRow, otherChain], missing).map(({ split }) => split), [undefined, undefined]);
const byTimestamp = [splitRow, nayRow].map((row) => ({ ...row, extrinsicIndex: undefined }));
assert.deepEqual(markSplitVotes(byTimestamp, missing).map(({ split }) => split), [undefined, undefined]);


// Conviction multipliers and voting power (OpenGov / Subsquare)
assert.equal(convictionMultiplier("None"), 0.1);
assert.equal(convictionMultiplier("0x"), 0.1);
assert.equal(convictionMultiplier("0.1x"), 0.1);
assert.equal(convictionMultiplier(0), 0.1);
assert.equal(convictionMultiplier("1x"), 1);
assert.equal(convictionMultiplier("Locked6x"), 6);
assert.equal(convictionMultiplier("6x"), 6);
assert.equal(convictionMultiplier("—"), null);
assert.equal(convictionMultiplier(""), null);

const p = (n) => (PAS * BigInt(n)).toString(); // n PAS in planck, integer only
assert.equal(voteVotingPower({ side: "Aye", amount: p(10), conviction: "6x" }), PAS * BigInt(60));
assert.equal(voteVotingPower({ side: "Aye", amount: p(10), conviction: "0.1x" }), PAS);
assert.equal(voteVotingPower({ side: "Nay", amount: p(4), conviction: "3x" }), PAS * BigInt(12));
assert.equal(voteVotingPower({ side: "Aye", amount: p(10), conviction: "None" }), PAS);
assert.equal(voteVotingPower({ side: "Aye", amount: p(3), conviction: "0.1x", split: "Split" }), PAS * BigInt(3) / BigInt(10));
assert.equal(voteVotingPower({ side: "Nay", amount: p(4), conviction: "0.1x", split: "Split" }), PAS * BigInt(4) / BigInt(10));
// Split aye/nay stay at 0.1x even if a conviction label leaks through
assert.equal(voteVotingPower({ side: "Aye", amount: p(3), conviction: "6x", split: "SplitAbstain" }), PAS * BigInt(3) / BigInt(10));
// Abstain (and SplitAbstain abstain) has no conviction: count the amount at face value
assert.equal(voteVotingPower({ side: "Abstain", amount: p(2), conviction: "—" }), PAS * BigInt(2));
assert.equal(voteVotingPower({ side: "Abstain", amount: p(2), conviction: "0.1x", split: "SplitAbstain" }), PAS * BigInt(2));
// Paseo #151 current SplitAbstain: aye 3 / nay 4 / abstain 2 PAS
assert.equal(voteVotingPower({ side: "Aye", amount: p(3), conviction: "0.1x", split: "SplitAbstain" }), BigInt("3000000000"));
assert.equal(voteVotingPower({ side: "Nay", amount: p(4), conviction: "0.1x", split: "SplitAbstain" }), BigInt("4000000000"));
assert.equal(voteVotingPower({ side: "Abstain", amount: p(2), conviction: "—", split: "SplitAbstain" }), PAS * BigInt(2));
assert.equal(voteVotingPower({ side: "Aye", amount: "0", conviction: "1x" }), BigInt(0));
assert.equal(voteVotingPower({ side: "Aye", amount: "not-a-number", conviction: "1x" }), null);
assert.equal(voteVotingPower({ side: "Aye", amount: p(1), conviction: "—" }), null);

console.log("vote tests passed");

// Metadata v16: signed v4 extrinsics use extension version 0 only
const { signedTransactionExtensions } = await import("../src/lib/transaction-extensions.ts");
const id = (value) => ({ toString: () => String(value) });
const names = ["AuthorizeCall", "CheckNonce", "ChargeAssetTxPayment", "CheckMetadataHash", "VerifyMultiSignature", "AsPgas"];
const metadataV16 = {
  transactionExtensions: names.map((name) => ({ identifier: id(name) })),
  transactionExtensionsByVersion: new Map([[id(0), [0, 1, 2, 3].map(id)], [id(1), [4, 0, 5, 1, 2, 3].map(id)]]),
};
assert.deepEqual(signedTransactionExtensions(metadataV16), ["AuthorizeCall", "CheckNonce", "ChargeAssetTxPayment", "CheckMetadataHash"]);
assert.equal(signedTransactionExtensions({ transactionExtensions: [] }), null);
assert.equal(signedTransactionExtensions({ transactionExtensions: metadataV16.transactionExtensions }), null);
assert.equal(signedTransactionExtensions({ ...metadataV16, transactionExtensionsByVersion: new Map([[id(0), [id(9)]]]) }), null);
// Mock the status subscription: no network, wallet or signing.
function watchFinality(timeoutMs) {
  const progress = [];
  let emit;
  let stops = 0;
  const pending = waitForConvictionFinality((notify, startConfirmation) => {
    emit = notify;
    startConfirmation();
    return Promise.resolve(() => { stops += 1; });
  }, (status) => progress.push(status), timeoutMs);
  return { pending, progress, emit, stopCount: () => stops };
}

function finalized(blockHash, overrides) {
  return {
    status: "Finalized",
    readFinalizedReceipt: () => verifyConvictionReceipt({
      readReceipt: () => ({ txHash: "0xtx", blockHash }),
      hasSuccessEvent: true,
      lookupFailed: false,
      ...overrides,
    }),
  };
}

const reorg = watchFinality();
let receiptShown = false;
void reorg.pending.then(() => { receiptShown = true; });
reorg.emit({ ...finalized("0xA", { dispatchError: () => assert.fail("Do not decode a provisional dispatch error") }), status: "InBlock" });
await Promise.resolve();
assert.equal(receiptShown, false);
reorg.emit({ status: "Retracted" });
await Promise.resolve();
assert.equal(receiptShown, false);
reorg.emit({ status: "InBlock" });
reorg.emit(finalized("0xB"));
assert.deepEqual(await reorg.pending, { txHash: "0xtx", blockHash: "0xB" });
assert.deepEqual(reorg.progress, ["Submitting to network", "In block · waiting for finality", "Block retracted · waiting for inclusion", "In block · waiting for finality", "Finalized"]);
reorg.emit({ status: "Broadcast" });
reorg.emit(finalized("0xC"));
assert.equal(reorg.progress.length, 5);
assert.equal(reorg.stopCount(), 1);

for (const status of ["Dropped", "Invalid", "Usurped", "FinalityTimeout"]) {
  const failed = watchFinality();
  failed.emit({ status: "InBlock" });
  failed.emit({ status: "Retracted" });
  failed.emit({ status });
  await assert.rejects(failed.pending, /Check the chain before retrying/);
  assert.equal(failed.stopCount(), 1);
}
const timedOut = watchFinality(1);
timedOut.emit({ status: "InBlock" });
timedOut.emit({ status: "Retracted" });
await assert.rejects(timedOut.pending, /confirmation timed out/);
assert.equal(timedOut.stopCount(), 1);

for (const [overrides, expected] of [
  [{ dispatchError: () => "convictionVoting.InsufficientFunds: Example." }, /convictionVoting\.InsufficientFunds/],
  [{ hasSuccessEvent: false }, /could not be verified/],
  [{ lookupFailed: true }, /could not be verified/],
]) {
  const failed = watchFinality();
  failed.emit({ status: "InBlock" });
  failed.emit(finalized("0xB", overrides));
  await assert.rejects(failed.pending, expected);
  assert.equal(failed.stopCount(), 1);
}

// Wallet approval may outlast the entire network deadline and then finalize normally.
let approveWallet;
const walletApproval = new Promise((resolve) => { approveWallet = resolve; });
const slowWalletProgress = [];
const slowWallet = waitForConvictionFinality(async (notify, startConfirmation) => {
  await walletApproval;
  startConfirmation();
  notify(finalized("0xSlowWallet"));
  return () => {};
}, (progress) => slowWalletProgress.push(progress), 1);
let walletSettled = false;
void slowWallet.then(
  () => { walletSettled = true; },
  () => { walletSettled = true; },
);
await delay(15);
assert.equal(walletSettled, false);
assert.deepEqual(slowWalletProgress, []);
approveWallet();
assert.equal((await slowWallet).blockHash, "0xSlowWallet");
assert.deepEqual(slowWalletProgress, ["Submitting to network", "Finalized"]);

let lateStops = 0;
await waitForConvictionFinality((notify) => {
  notify(finalized("0xB"));
  return Promise.resolve(() => { lateStops += 1; });
});
assert.equal(lateStops, 1);
await assert.rejects(waitForConvictionFinality(() => { throw new Error("Wallet rejected"); }), /Wallet rejected/);
await assert.rejects(waitForConvictionFinality(() => Promise.reject("Watch unavailable")), /Watch unavailable/);

console.log("transaction extension tests passed");

// Exercise the real submission code with a local chain API stub.
const voteModule = new URL("../src/lib/vote.ts", import.meta.url);
const chainApiMock = Symbol.for("subgov.testChainApi");
const chainApiSource = "export const getChainApi = async () => globalThis[Symbol.for('subgov.testChainApi')];";
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === voteModule.href) {
      if (specifier === "./chain-api") return { url: `data:text/javascript,${encodeURIComponent(chainApiSource)}`, shortCircuit: true };
      if (specifier.startsWith("./")) return nextResolve(`${specifier}.ts`, context);
    }
    if (context.parentURL?.startsWith(new URL("../src/", import.meta.url).href) && specifier.startsWith("./") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const { submitReferendumVote, submitDelegation } = await import(voteModule.href);
hooks.deregister();

const calls = [];
let trackState = {};
let proxyDefinitions = [];
let proxyError = null;
const extrinsic = (name) => ({
  paymentInfo: async () => {
    calls.push("estimate fee");
    return { partialFee: { toBigInt: () => 2n } };
  },
  signAndSend: async (address, { signer }, notify) => {
    calls.push(name);
    await signer.signPayload({});
    notify({
      status: { type: "Finalized", isFinalized: true, asFinalized: { toHex: () => "0xblock" } },
      txHash: { toHex: () => "0xtx" },
      events: [
        { event: { section: "system", method: "ExtrinsicSuccess" } },
        ...(name === "proxy" ? [{ event: { section: "proxy", method: "ProxyExecuted", data: [{ isErr: Boolean(proxyError), asErr: { isModule: false, toString: () => proxyError } }] } }] : []),
      ],
    });
    return () => {};
  },
});
globalThis[chainApiMock] = {
  registry: { signedExtensions: [] },
  events: { proxy: { ProxyExecuted: { is: (event) => event.section === "proxy" && event.method === "ProxyExecuted" } } },
  consts: { referenda: { tracks: { toJSON: () => [[0, { name: "root" }]] } } },
  query: {
    proxy: { proxies: async () => ({ toJSON: () => [proxyDefinitions, 0] }) },
    convictionVoting: { votingFor: async () => ({ toJSON: () => trackState }) },
    referenda: { referendumInfoFor: async () => ({ isSome: true, unwrap: () => ({ isOngoing: true }) }) },
    system: { account: async () => ({ toJSON: () => ({ data: { free: "100", reserved: "0" } }) }) },
  },
  tx: {
    proxy: { proxy: (real, type) => { calls.push(["proxy type", real, type]); return extrinsic("proxy"); } },
    convictionVoting: {
      vote: () => extrinsic("vote"),
      delegate: () => extrinsic("delegate"),
      undelegate: () => extrinsic("undelegate"),
    },
    utility: { batchAll: () => extrinsic("replace delegation") },
  },
};
const transaction = {
  rpc: "mock",
  genesisHash: "0x00",
  address: "signer",
  trackId: 0,
  decimals: 0,
  conviction: "1x",
  signer: { signPayload: async () => { calls.push("sign"); return { id: 1, signature: "0x" }; } },
};
const voteArgs = { ...transaction, referendumId: 151, mode: "Aye" };
await assert.rejects(submitReferendumVote({ ...voteArgs, amounts: { amount: "100" } }), /estimated network fee/);
assert.deepEqual(calls.splice(0), ["estimate fee"]);
await submitReferendumVote({ ...voteArgs, amounts: { amount: "98" } });
assert.deepEqual(calls.splice(0), ["estimate fee", "vote", "sign"]);

const delegationArgs = { ...transaction, target: "new delegate", amount: "25" };
await submitDelegation({ ...delegationArgs, expectedDelegation: null });
assert.deepEqual(calls.splice(0), ["delegate", "sign"]);
trackState = { delegating: { target: "old delegate", conviction: "Locked6x", balance: "75" } };
await assert.rejects(submitDelegation({ ...delegationArgs, expectedDelegation: null }), /changed/);
assert.deepEqual(calls.splice(0), []);
const reviewed = { target: "old delegate", conviction: "Locked6x", balance: 75n };
await submitDelegation({ ...delegationArgs, expectedDelegation: reviewed });
assert.deepEqual(calls.splice(0), ["replace delegation", "sign"]);

trackState = {};
proxyDefinitions = [
  { delegate: "proxy signer", proxyType: "Any", delay: 20 },
  { delegate: "proxy signer", proxyType: "Staking", delay: 0 },
  { delegate: "proxy signer", proxyType: "Governance", delay: 0 },
];
const proxyVote = { ...voteArgs, signAs: "proxy signer", amounts: { amount: "100" } };
await submitReferendumVote(proxyVote);
assert.deepEqual(calls.splice(0), [["proxy type", "signer", "Governance"], "proxy", "sign"], "the proxy pays fees; the real account may vote its full balance");
proxyError = "CallFiltered";
await assert.rejects(submitReferendumVote(proxyVote), /CallFiltered/);
calls.splice(0);
proxyDefinitions = [{ delegate: "proxy signer", proxyType: "Governance", delay: 20 }];
await assert.rejects(submitReferendumVote(proxyVote), /no longer has/);
assert.deepEqual(calls, [], "revoked or delayed proxies must fail before signing");
delete globalThis[chainApiMock];

console.log("vote submission tests passed");
