import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(".env", "utf8").split(/\r?\n/).filter(Boolean).map((line) => line.split(/=(.*)/s)));
process.env.PUBFI_API_KEY ??= env.PUBFI_API_KEY;

const key = process.env.PUBFI_API_KEY;
if (!key) throw new Error("PUBFI_API_KEY is not configured");

const checks = [
  ["assethub-polkadot", "now", "GET"],
  ["assethub-polkadot", "scan/referenda/referendums", "POST", { page: 0, row: 1 }],
  ["assethub-polkadot", "scan/treasury_spend/proposals", "POST", { page: 0, row: 1 }],
  ["assethub-polkadot", "scan/treasury_spend/proposal", "POST", { proposal_id: 202 }],
  ["assethub-polkadot", "scan/bounties/proposals", "POST", { page: 0, row: 1 }],
  ["assethub-polkadot", "scan/referenda/tracks", "POST", {}],
  ["assethub-polkadot", "scan/governance/desc", "POST", { id: "135", gov: "referendums_v2" }],
  ["assethub-polkadot", "scan/referenda/votes", "POST", { referendum_index: 1780, page: 0, row: 1, order: "desc" }],
  ["collectives-polkadot", "scan/fellowship/statistics", "POST", {}],
  ["people-polkadot", "scan/accounts/statistics", "POST", {}],
  ["people-polkadot", "scan/search/identity", "POST", { identity: "Alice", page: 0, row: 1 }],
];

for (const [network, path, method, body] of checks) {
  const response = await fetch(`https://api.pubfi.ai/v1/gateway/subscan/${network}/api/${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const json = await response.json();
  if (!response.ok || json.code !== 0) throw new Error(`${path}: ${response.status} ${json.message ?? "failed"}`);
  console.log(`ok ${method} ${path}`);
}
