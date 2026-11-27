import assert from "node:assert/strict";
import {
  governanceUpstream,
  resolveSubscanRequest,
  SUBSCAN_UPSTREAMS,
  subscanSource,
} from "../src/lib/subscan-request.ts";

const bases = {
  polkadot: "http://polkadot.internal.test",
  kusama: "http://kusama.internal.test",
  "assethub-polkadot": "http://assethub-polkadot.internal.test",
  "assethub-kusama": "http://assethub-kusama.internal.test",
  "assethub-paseo": "http://assethub-paseo.internal.test",
  statemint: "http://assethub-polkadot.internal.test",
  "collectives-polkadot": "http://collectives-polkadot.internal.test",
  "coretime-polkadot": "http://coretime-polkadot.internal.test",
  "coretime-kusama": "http://coretime-kusama.internal.test",
  "people-polkadot": "http://people-polkadot.internal.test",
  "people-kusama": "http://people-kusama.internal.test",
};
const clusterEnv = { SUBSCAN_CLUSTER_BASE_URLS: JSON.stringify(bases) };

const path = "scan/referenda/referendums";
for (const network of ["polkadot", "kusama", "paseo"]) {
  const hub = governanceUpstream(network);
  assert.equal(hub, `assethub-${network}`);
  assert.equal(governanceUpstream(hub), hub);
  assert.equal(resolveSubscanRequest("cluster", hub, path, clusterEnv).url, `${bases[hub]}/api/${path}`);
  assert.equal(resolveSubscanRequest("subscan", hub, path, { SUBSCAN_API_KEY: "test" }).url, `https://${hub}.api.subscan.io/api/${path}`);
  assert.equal(resolveSubscanRequest("pubfi", hub, path, { PUBFI_API_KEY: "test" }).url, `https://api.pubfi.ai/v1/gateway/subscan/${hub}/api/${path}`);
}
// Legacy tips have no Asset Hub index; current treasury and OpenGov reads must keep theirs.
for (const network of ["polkadot", "kusama"]) {
  const tips = governanceUpstream(network, "/scan/treasury/tips");
  assert.equal(tips, network);
  for (const [source, env, prefix] of [
    ["subscan", { SUBSCAN_API_KEY: "test" }, `https://${network}.api.subscan.io`],
    ["cluster", clusterEnv, bases[network]],
    ["pubfi", { PUBFI_API_KEY: "test" }, `https://api.pubfi.ai/v1/gateway/subscan/${network}`],
  ]) assert.equal(resolveSubscanRequest(source, tips, "scan/treasury/tips", env).url, `${prefix}/api/scan/treasury/tips`);
  for (const path of ["scan/treasury/burns", "scan/treasury_spend/proposals", "scan/referenda/referendums"])
    assert.equal(governanceUpstream(network, path), `assethub-${network}`);
}
assert.equal(governanceUpstream("paseo", "scan/treasury/tips"), "assethub-paseo");
assert.equal(governanceUpstream("statemint"), "statemint");
assert.equal(resolveSubscanRequest("cluster", "kusama", "scan/fellowship/statistics", clusterEnv).url,
  `${bases.kusama}/api/scan/fellowship/statistics`);

const paseo = resolveSubscanRequest("cluster", "paseo", "/scan/referenda/tracks", clusterEnv);
assert.equal(paseo.url, "http://assethub-paseo.internal.test/api/scan/referenda/tracks");
assert.deepEqual(paseo.headers, {});

const collectives = resolveSubscanRequest("cluster", "collectives-polkadot", "scan/fellowship/statistics", clusterEnv);
assert.equal(collectives.url, "http://collectives-polkadot.internal.test/api/scan/fellowship/statistics");
assert.deepEqual(collectives.headers, {});

for (const network of SUBSCAN_UPSTREAMS) {
  assert.equal(resolveSubscanRequest("cluster", network, "now", clusterEnv).url, `${bases[network]}/api/now`);
}

assert.throws(
  () => resolveSubscanRequest("cluster", "polkadot", "now", { SUBSCAN_CLUSTER_BASE_URLS: "{" }),
  /must be valid JSON/,
);
assert.throws(
  () => resolveSubscanRequest("cluster", "polkadot", "now", {
    SUBSCAN_CLUSTER_BASE_URLS: JSON.stringify({ ...bases, "people-kusama": undefined }),
  }),
  /missing people-kusama/,
);
assert.throws(
  () => resolveSubscanRequest("cluster", "polkadot", "now", {
    SUBSCAN_CLUSTER_BASE_URLS: JSON.stringify({ ...bases, polkadot: "ftp://polkadot.internal.test" }),
  }),
  /invalid URL for polkadot/,
);

assert.throws(() => resolveSubscanRequest("subscan", "polkadot", "now", {}), /SUBSCAN_API_KEY is not configured/);
assert.deepEqual(
  resolveSubscanRequest("subscan", "polkadot", "now", { SUBSCAN_API_KEY: "test-subscan-key" }),
  {
    url: "https://polkadot.api.subscan.io/api/now",
    headers: { "X-API-Key": "test-subscan-key" },
  },
);

assert.throws(() => resolveSubscanRequest("pubfi", "polkadot", "now", {}), /PUBFI_API_KEY is not configured/);
assert.deepEqual(
  resolveSubscanRequest("pubfi", "paseo", "now", { PUBFI_API_KEY: "test-pubfi-key" }),
  {
    url: "https://api.pubfi.ai/v1/gateway/subscan/assethub-paseo/api/now",
    headers: { Authorization: "Bearer test-pubfi-key" },
  },
);
assert.equal(subscanSource({ NODE_ENV: "development" }), "subscan");
assert.equal(subscanSource({ NODE_ENV: "development", SUBSCAN_API_SOURCE: "pubfi" }), "pubfi");
assert.equal(subscanSource({ NODE_ENV: "production" }), "subscan");
assert.equal(subscanSource({ SUBSCAN_API_SOURCE: "cluster" }), "cluster");

console.log("subscan request checks passed");
