// Opt-in, read-only runtime smoke test. Never signs or submits an extrinsic.
import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";

const pnpm = new URL("../node_modules/.pnpm/", import.meta.url);
const jitiPackage = (await readdir(pnpm)).find((name) => name.startsWith("jiti@"));
const { createJiti } = await import(new URL(`${jitiPackage}/node_modules/jiti/lib/jiti.mjs`, pnpm));
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../src", import.meta.url).pathname } });
const { chains } = await jiti.import("../src/lib/chains.ts");
const { getChainApi, disconnectChainApis } = await jiti.import("../src/lib/chain-api.ts");
const { readTreasuryOverview, readMultiAssetBounties, readMultiAssetChildren } = await jiti.import("../src/lib/treasury-chain.ts");
const { readAccountVoting } = await jiti.import("../src/lib/account-chain.ts");
const { callTree, callCount } = await jiti.import("../src/lib/call-tree.ts");
const { parseOnChainReferendumTally } = await jiti.import("../src/lib/referendum-tally.ts");
const { readGovernanceBlockSeconds } = await jiti.import("../src/lib/governance-clock.ts");
const address = `0x${"11".repeat(32)}`;
const watchdog = setTimeout(() => { console.error("RPC smoke test timed out"); process.exit(1); }, 180_000);
try {
  const results = await Promise.allSettled(chains.map(async (chain) => {
    const api = await getChainApi(chain.rpc, chain.genesisHash);
    assert.equal(api.genesisHash.toHex(), chain.genesisHash);
    const referendumId = Number((await api.query.referenda.referendumCount()).toString()) - 1;
    const calls = [
      api.tx.convictionVoting.vote(referendumId, { Standard: { vote: { aye: true, conviction: "Locked1x" }, balance: "10000000000" } }),
      api.tx.convictionVoting.vote(referendumId, { Split: { aye: "10000000000", nay: "0" } }),
      api.tx.convictionVoting.vote(referendumId, { SplitAbstain: { aye: "0", nay: "0", abstain: "10000000000" } }),
      api.tx.convictionVoting.removeVote(0, referendumId),
      api.tx.convictionVoting.unlock(0, address),
      api.tx.convictionVoting.delegate(0, address, "Locked1x", "10000000000"),
      api.tx.convictionVoting.undelegate(0),
      api.tx.referenda.placeDecisionDeposit(referendumId),
      api.tx.referenda.refundSubmissionDeposit(referendumId),
      api.tx.referenda.refundDecisionDeposit(referendumId),
      api.tx.preimage.unnotePreimage(`0x${"00".repeat(32)}`),
      api.tx.treasury.payout(0), api.tx.treasury.checkStatus(0),
    ];
    for (const call of calls) assert(call.method.toHex().length > 6);
    const batch = api.tx.utility.batchAll(calls.slice(3, 5));
    const proxy = api.tx.proxy.proxy(address, "Governance", batch);
    assert.equal(callCount(callTree(proxy.method)), 4);
    const [overview, bounties, voting, info] = await Promise.all([
      readTreasuryOverview(chain), readMultiAssetBounties(chain),
      readAccountVoting({ ...chain, address }), api.query.referenda.referendumInfoFor(referendumId),
    ]);
    assert(voting.now > 0);
    assert(overview.balances.every((row) => row.free >= 0n));
    if (info.isSome && info.unwrap().isOngoing) assert(parseOnChainReferendumTally(info.toJSON()));
    const children = bounties?.length ? await readMultiAssetChildren(chain, bounties[0].id) : [];
    const secondsPerGovernanceBlock = await readGovernanceBlockSeconds(api);
    assert(secondsPerGovernanceBlock > 0);
    return { chain: chain.id, specVersion: api.runtimeVersion.specVersion.toString(), governanceBlock: voting.now,
      secondsPerGovernanceBlock,
      callsEncoded: calls.length + 2, latestReferendum: referendumId, multiAssetBounties: bounties?.length ?? "unsupported", sampleChildren: children.length,
      bountyAssets: bounties?.map(({ id, asset }) => ({ id, ...asset })),
      treasuryAssets: overview.balances.map(({ symbol, decimals }) => ({ symbol, decimals })) };
  }));
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") console.log(JSON.stringify(result.value));
    else { console.error(chains[i].id, result.reason); process.exitCode = 1; }
  }
} finally {
  await disconnectChainApis();
  clearTimeout(watchdog);
}
