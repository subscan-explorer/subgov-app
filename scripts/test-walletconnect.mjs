import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Exercise the installed SDK path, including its CommonJS query-string consumer.
// This catches a decoder upgrade that installs successfully but fails at pairing.
const onboard = createRequire(import.meta.resolve("@polkadot-onboard/wallet-connect"));
const sdk = createRequire(onboard.resolve("@walletconnect/sign-client"));
const { formatUri, parseUri } = sdk("@walletconnect/utils");
const utilities = createRequire(sdk.resolve("@walletconnect/utils"));
const query = utilities("query-string");

const topic = "11".repeat(32);
const symKey = "22".repeat(32);
const relay = { protocol: "irn", data: "hello world & 中文 / ? = + %" };
const uri = formatUri({ protocol: "wc", topic, version: 2, symKey, relay });
const parsed = parseUri(uri);
assert.equal(parsed.topic, topic);
assert.equal(parsed.symKey, symKey);
assert.equal(parsed.version, 2);
assert.deepEqual(parsed.relay, relay);

assert.deepEqual({ ...query.parse("text=%E4%B8%AD%E6%96%87&space=hello+world&empty=&flag") }, {
  text: "中文", space: "hello world", empty: "", flag: null,
});
assert.doesNotThrow(() => query.parse("malformed=%E0%A4%A&percent=%"));
assert.equal(query.parse(query.stringify({ redirect: "https://example.test/?a=1&b=2#target" })).redirect,
  "https://example.test/?a=1&b=2#target");

console.log("WalletConnect pairing URI and patched decoder compatibility passed");
