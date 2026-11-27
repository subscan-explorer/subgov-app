import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Source files omit ".ts" from relative imports; Node needs the suffix when running these tests.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("./") && !specifier.endsWith(".ts") && context.parentURL?.includes("/src/lib/")) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const {
  abstainAmountFromVotes,
  approvalFromWeightedVotes,
  formatTallyView,
  governanceInclusionPhase,
  parseOnChainReferendumTally,
  planckFromChain,
} = await import("../src/lib/referendum-tally.ts");
const { replaceAccountVotes, voteRowsFromExisting } = await import("../src/lib/conviction-voting.ts");
const { encodeAddress } = await import("@polkadot/util-crypto");
const publicKey = `0x${"11".repeat(32)}`;
const indexedAddress = encodeAddress(publicKey, 0);
const walletAddress = encodeAddress(publicKey, 42);
assert.equal(replaceAccountVotes([{ voter: indexedAddress }], walletAddress, []).length, 0, "SS58 prefixes must not duplicate a voter's rows");

const PAS = 10;

assert.equal(planckFromChain(0), BigInt(0));
assert.equal(planckFromChain("1050000000000"), BigInt("1050000000000"));
assert.equal(planckFromChain("1,050,000,000,000"), BigInt("1050000000000"));
assert.equal(planckFromChain("0x3a35294400"), BigInt("250000000000"));
assert.equal(planckFromChain(5_000_000_000), BigInt("5000000000"));
assert.equal(planckFromChain("-1"), null);
assert.equal(planckFromChain("1.5"), null);
assert.equal(planckFromChain(Number.MAX_SAFE_INTEGER + 1), null);

const pre = parseOnChainReferendumTally({
  ongoing: { tally: { ayes: "5000000000", nays: "1000000000", support: "1050000000000" } },
});
assert.deepEqual(pre, { ayes: BigInt("5000000000"), nays: BigInt("1000000000"), support: BigInt("1050000000000") });
assert.equal(approvalFromWeightedVotes(pre.ayes, pre.nays), 83.33);
assert.deepEqual(formatTallyView(pre, PAS), {
  aye: "0.5",
  nay: "0.1",
  supportAmount: "105",
  approval: 83.33,
});

const post = parseOnChainReferendumTally({
  Ongoing: { Tally: { Ayes: 6_000_000_000_000, Nays: 0, Support: "1000000000000" } },
});
assert.deepEqual(formatTallyView(post, PAS), {
  aye: "600",
  nay: "0",
  supportAmount: "100",
  approval: 100,
});

assert.equal(parseOnChainReferendumTally({ approved: [1, null, null] }), null);
assert.equal(parseOnChainReferendumTally({ ongoing: {} }), null);

assert.equal(governanceInclusionPhase("In block · waiting for finality"), "inBlock");
assert.equal(governanceInclusionPhase("In block · finalizing…"), "inBlock");
assert.equal(governanceInclusionPhase("Finalized"), "finalized");
assert.equal(governanceInclusionPhase("Broadcasting"), null);
assert.equal(governanceInclusionPhase("Block retracted · waiting for inclusion"), null);

const splitRows = voteRowsFromExisting(
  { mode: "Abstain", aye: BigInt("50000000000"), nay: BigInt("10000000000"), abstain: BigInt("1000000000000") },
  { voter: "5DJ5", at: "2026-11-23T03:37:48.000Z", extrinsicIndex: "16105878-2" },
);
assert.deepEqual(splitRows.map((row) => [row.side, row.amount, row.conviction, row.split]), [
  ["Aye", "50000000000", "0.1x", "SplitAbstain"],
  ["Nay", "10000000000", "0.1x", "SplitAbstain"],
  ["Abstain", "1000000000000", "—", "SplitAbstain"],
]);
assert.equal(abstainAmountFromVotes(splitRows, PAS), "100");

const standard = voteRowsFromExisting(
  { mode: "Aye", conviction: "Locked6x", balance: BigInt("1000000000000") },
  { voter: "5DJ5", at: "2026-11-23T03:37:48.000Z", extrinsicIndex: "16105879-2" },
);
assert.deepEqual(standard, [{
  voter: "5DJ5",
  at: "2026-11-23T03:37:48.000Z",
  extrinsicIndex: "16105879-2",
  side: "Aye",
  amount: "1000000000000",
  conviction: "6x",
}]);

const other = { voter: "5OTHER", side: "Nay", amount: "1", conviction: "1x", at: "2026-11-01T00:00:00.000Z" };
assert.equal(voteRowsFromExisting({ mode: "Aye", balance: 1n, conviction: "None" }, { voter: "A" })[0].at, "", "storage-only rows must not invent a vote time");
const replaced = replaceAccountVotes([...splitRows, other], "5DJ5", standard);
assert.equal(replaced.length, 2);
assert.equal(replaced[0].side, "Aye");
assert.equal(replaced[0].conviction, "6x");
assert.equal(replaced[1].voter, "5OTHER");
assert.equal(abstainAmountFromVotes(replaced, PAS), null);

console.log("test-tally: ok");
