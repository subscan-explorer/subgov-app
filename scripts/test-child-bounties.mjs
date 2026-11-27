import assert from "node:assert/strict";
import { childBountyIds, childBountyPayout, findChildBounty } from "../src/lib/child-bounties.ts";

assert.deepEqual(childBountyIds({ index: "10-42" }), { parent: 10, index: 42 });
assert.deepEqual(childBountyIds({ index: "0-0" }), { parent: 0, index: 0 });
assert.deepEqual(childBountyIds({ parent_bounty_id: 10, child_index: 42 }), { parent: 10, index: 42 });
assert.deepEqual(childBountyIds({ index: 42 }, 10), { parent: 10, index: 42 });
const seen = [];
const target = { index: "10-4" };
assert.equal(await findChildBounty(10, 4, 2, async (page) => {
  seen.push(page);
  return { count: 3, list: page === 0 ? [{ index: "10-6" }, { index: "10-5" }] : [target] };
}), target);
assert.deepEqual(seen, [0, 1]);
assert.equal(await findChildBounty(0, 4, 2, async () => ({ count: 1, list: [{ index: "1-4" }] })), undefined, "parent zero must not match another parent's row");
await assert.rejects(findChildBounty(10, 4, 1, async () => ({ count: 100, list: [{ index: "10-8" }] }), 2), /too much history/);
await assert.rejects(findChildBounty(10, 4, 1, async () => { throw new Error("upstream unavailable"); }), /upstream unavailable/);
console.log("child bounty IDs and paginated lookup passed");

// Kusama #32-8: the index contains the net payout, not 1,460.57999 KSM gross.
assert.equal(childBountyPayout({ status: "Claimed", amount: "1459579990000000" }), "1459579990000000");
assert.equal(childBountyPayout({ status: "claimed", amount: "0" }), "0");
for (const row of [{ status: "Added", amount: "0" }, { status: "Awarded", amount: "0" }, { status: "Claimed" }, { status: "Claimed", amount: "" }, { status: "Claimed", value: "1460579990000000" }]) assert.equal(childBountyPayout(row), null);
