import assert from "node:assert/strict";
import { discussionKeyType, referendumDiscussionPath } from "../src/lib/discussion.ts";

assert.equal(referendumDiscussionPath("polkadot", 42), "/chains/polkadot/referenda/42");
assert.equal(referendumDiscussionPath("paseo", 130), "/chains/paseo-asset-hub/referenda/130");
assert.equal(referendumDiscussionPath("kusama", 0), "/chains/kusama/referenda/0");
assert.equal(discussionKeyType(undefined), "sr25519");
assert.equal(discussionKeyType(undefined, "ed25519"), "ed25519");
assert.equal(discussionKeyType("ecdsa", "sr25519"), "ecdsa");

console.log("discussion path checks passed");
