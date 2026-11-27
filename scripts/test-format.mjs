import assert from "node:assert/strict";
import { blockSeconds, measuredClockSeconds } from "../src/lib/block-time.ts";
import { decisionCurveThreshold, parseDecisionCurve } from "../src/lib/decision-curve.ts";
import { excerptTitle, formatBaseUnits, formatBlockPeriod, formatDate, formatStatusLabel, planckToToken, statusTone } from "../src/lib/format.ts";
import { isLiveReferendum } from "../src/lib/referendum-deadline.ts";
import { referendumStatus } from "../src/lib/referendum-status.ts";
import { decisionProgress, onChainReferendumDeadline, periodToMs, referendumDeadline } from "../src/lib/referendum-deadline.ts";
import { accountProfileIdentity } from "../src/lib/account-profile.ts";
import { lastVotesPage, requestedVotesPage } from "../src/lib/referendum-votes.ts";
import { chains, governanceChains, referendumBlockExplorer } from "../src/lib/chains.ts";
import { walletCanSignOnChain, walletConnectChains } from "../src/lib/wallet-chain.ts";
import { hasSpendRecord } from "../src/lib/treasury-record.ts";
import { hasReferendumTally } from "../src/lib/referendum-tally.ts";
import { readSubscanPage, referendaListQuery } from "../src/lib/subscan-page.ts";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Fast Asset Hub blocks must not shorten Relay-clock governance periods.
const relaySeconds = measuredClockSeconds({ timestampMs: 0, block: 1000 }, { timestampMs: 600_000, block: 1100 });
assert.equal(relaySeconds, 6);
assert.equal(formatBlockPeriod(100_800, relaySeconds), "7d");
assert.equal(measuredClockSeconds({ timestampMs: 0, block: 1000 }, { timestampMs: 600_000, block: 1300 }), 2);
assert.equal(measuredClockSeconds({ timestampMs: 0, block: 1000 }, { timestampMs: 600_000, block: 1000 }), null);
assert.equal(measuredClockSeconds({ timestampMs: NaN, block: 1 }, { timestampMs: 2, block: 2 }), null);

const pnpm = new URL("../node_modules/.pnpm/", import.meta.url);
const jitiPackage = (await readdir(pnpm)).find((name) => name.startsWith("jiti@"));
if (!jitiPackage) throw new Error("jiti is required to load track mapping in this test");
const { createJiti } = await import(new URL(`${jitiPackage}/node_modules/jiti/lib/jiti.mjs`, pnpm));
const { mapGovernanceTracks } = await createJiti(import.meta.url, {
  moduleCache: false,
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
}).import("../src/lib/referendum-tracks.ts");

const reciprocal = parseDecisionCurve({ Reciprocal: { factor: "222222224", x_offset: "333333335", y_offset: "333333332" } });
assert.ok(reciprocal);
assert.equal(reciprocal.label, "Reciprocal");
assert.ok(Math.abs(decisionCurveThreshold(reciprocal, 0) - 1) < 1e-8);
assert.ok(Math.abs(decisionCurveThreshold(reciprocal, 1) - 0.5) < 1e-8);

const linear = parseDecisionCurve({ LinearDecreasing: { length: "1000000000", floor: "500000000", ceil: "1000000000" } });
assert.ok(linear);
assert.equal(linear.label, "Linear Decreasing");
assert.equal(decisionCurveThreshold(linear, 0.5), 0.75);
assert.equal(parseDecisionCurve(undefined), undefined);

assert.equal(requestedVotesPage(undefined), 0);
assert.equal(requestedVotesPage("1"), 0);
assert.equal(requestedVotesPage("2"), 1);
assert.equal(requestedVotesPage("0"), null);
assert.equal(requestedVotesPage("999"), 998);
assert.equal(requestedVotesPage("1.5"), null);
assert.equal(lastVotesPage(0, 20), 0);
assert.equal(lastVotesPage(20, 20), 0);
assert.equal(lastVotesPage(25, 20), 1);

assert.equal(planckToToken("0", 10), "0");
assert.equal(planckToToken("10000000000", 10), "1");
assert.equal(planckToToken("12345000000", 10), "1.2345");
assert.equal(planckToToken("123456789012345678901234567890", 10), "12345678901234567890.123456789");
assert.equal(formatBaseUnits("0", 10), "0");
assert.equal(formatBaseUnits("10000000000", 10), "1");
assert.equal(formatBaseUnits("12345000000", 10), "1.2345");
assert.equal(formatBaseUnits("123456789012345678901234567890", 10), "12,345,678,901,234,567,890.12");
assert.equal(formatBaseUnits("79200000000000000", 10), "7,920,000");
assert.equal(hasReferendumTally({ aye: null, nay: null, approval: 98.75 }), true);
assert.equal(hasReferendumTally({ aye: null, nay: null, approval: 0 }), true);
assert.equal(hasReferendumTally({ aye: "4.46", nay: "0.05", approval: null }), true);
assert.equal(hasReferendumTally({ aye: null, nay: null, approval: null }), false);
assert.equal(hasReferendumTally({ aye: "0", nay: "0", approval: null }), false);
assert.equal(accountProfileIdentity({ account_display: { people: { display: "Alice" }, identity: true, display: "Other" } }), "Alice");
assert.equal(accountProfileIdentity({ account_display: { identity: true, display: "Alice" } }), "Alice");
assert.equal(accountProfileIdentity({ account_display: { identity: false, display: "Alias" } }), null);
assert.equal(walletCanSignOnChain("wallet-connect", "0xpolkadot", "0xkusama"), false);
assert.equal(walletCanSignOnChain("wallet-connect", "0xpolkadot", "0xpolkadot"), true);
assert.equal(walletCanSignOnChain("talisman", null, "0xkusama"), true);
assert.equal(referendumBlockExplorer(governanceChains.polkadot, "2025-11-04T00:00:00Z"), "https://polkadot.subscan.io");
assert.equal(referendumBlockExplorer(governanceChains.kusama, "2025-10-06T00:00:00Z"), "https://kusama.subscan.io");
for (const chain of chains) {
  assert.equal(chain.subscanUrl, `https://assethub-${chain.id}.subscan.io`);
  assert.equal(referendumBlockExplorer(chain, "2026-11-19T00:00:00Z"), chain.subscanUrl);
  const expectedId = `polkadot:${chain.genesisHash.slice(2, 34)}`;
  assert.deepEqual(walletConnectChains(chain.genesisHash), {
    chainIds: [expectedId],
    optionalChainIds: [expectedId],
  });
}
assert.equal(hasSpendRecord({ proposal_id: 0 }), true);
assert.equal(hasSpendRecord({ proposal_id: 12 }), true);
assert.equal(hasSpendRecord({}), false);
assert.equal(hasSpendRecord(null), false);

assert.deepEqual(readSubscanPage({ count: 0, list: null }), { list: [], count: 0 });
assert.deepEqual(readSubscanPage({ count: 5, list: [{ id: 1973 }] }), { list: [{ id: 1973 }], count: 5 });
assert.deepEqual(readSubscanPage({ list: null }), { list: [], count: 0 });
assert.deepEqual(readSubscanPage(null), { list: [], count: 0 });
assert.deepEqual(referendaListQuery("active"), { status: "active" });
assert.deepEqual(referendaListQuery("preparing"), { status: "submitted" });
assert.deepEqual(referendaListQuery("deciding"), { status: "decision" });
assert.deepEqual(referendaListQuery("confirming"), { multi_status: ["confirmStarted", "confirm"] });
assert.deepEqual(referendaListQuery("all"), {});
assert.deepEqual(referendaListQuery(), {});
assert.deepEqual(referendaListQuery("executedfailed"), { status: "executedFailed" });
assert.equal(referendumStatus("ExecutedFailed"), "ExecutedFailed");
assert.equal(referendumStatus("executedfailed"), "ExecutedFailed");
assert.equal(referendumStatus("executed"), "Executed");
assert.equal(referendumStatus("submitted"), "Preparing");
assert.equal(referendumStatus("confirmaborted"), "Deciding");
assert.equal(referendumStatus("not-a-status"), "Preparing");
assert.equal(referendumStatus(null), "Preparing");
assert.equal(isLiveReferendum({ status: "ExecutedFailed" }), false);
assert.equal(isLiveReferendum({ status: "Deciding" }), true);
assert.equal(statusTone("ExecutedFailed"), "bad");
assert.equal(statusTone("Executed"), "good");
assert.equal(formatStatusLabel("ExecutedFailed"), "Executed failed");

const paseoTracks = mapGovernanceTracks({
  33: {
    name: "medium_spender",
    prepare_period: 2400,
    decision_period: 403200,
    confirm_period: 57600,
    min_enactment_period: 14400,
    decision_deposit: "2000000000000",
    max_deciding: 50,
    min_approval: { Reciprocal: { factor: "222222224", x_offset: "333333335", y_offset: "333333332" } },
    min_support: { LinearDecreasing: { length: "1000000000", floor: "0", ceil: "500000000" } },
  },
});
assert.equal(paseoTracks.length, 1);
assert.equal(paseoTracks[0].id, 33);
assert.equal(paseoTracks[0].name, "medium_spender");
assert.equal(paseoTracks[0].displayName, "Medium Spender");
assert.equal(paseoTracks[0].decisionPeriod, "403200");
assert.equal(paseoTracks[0].confirmPeriod, "57600");
assert.equal(paseoTracks[0].minApproval, "Reciprocal");
assert.equal(paseoTracks[0].minSupport, "Linear Decreasing");
assert.equal(paseoTracks[0].activeCount, null, "missing activity is not evidence of zero active referenda");
assert.equal(mapGovernanceTracks([{ id: 1, active_count: 0 }])[0].activeCount, 0);
assert.deepEqual(mapGovernanceTracks(null), []);
assert.deepEqual(mapGovernanceTracks({ list: [{ id: 1, name: "whitelisted_caller", decision_period: 403200 }] }).map((track) => track.name), ["whitelisted_caller"]);

assert.equal(blockSeconds("2.0304"), 2.0304);
assert.equal(blockSeconds("12.0888"), 12.0888);
assert.equal(blockSeconds(2), 2);
assert.equal(blockSeconds("0"), null);
assert.equal(blockSeconds("-1"), null);
assert.equal(blockSeconds(""), null);
assert.equal(blockSeconds("  "), null);
assert.equal(blockSeconds(null), null);
assert.equal(blockSeconds(undefined), null);

assert.equal(periodToMs("28d", null), 28 * 86_400_000);
assert.equal(periodToMs("3h", null), 3 * 3_600_000);
assert.equal(periodToMs("10m", null), 10 * 60_000);
assert.equal(periodToMs("403200", null), null);
assert.equal(periodToMs("403200", 0), null);
assert.equal(periodToMs("1800", 2), 3_600_000);
assert.equal(formatBlockPeriod("28d", null), "28d");
assert.equal(formatBlockPeriod("403200", null), "403,200 blocks");
assert.equal(formatBlockPeriod("403200", 2.0304), "9.5d");
assert.equal(formatBlockPeriod("100800", 2.0304), "2.4d");
assert.equal(formatBlockPeriod("1800", 2.0304), "1h");
assert.equal(formatBlockPeriod("100", 2.0304), "3m");
assert.equal(formatBlockPeriod("150", 12.0888), "30m");
assert.notEqual(formatBlockPeriod("150", 12.0888), formatBlockPeriod("150", 6));

// Polkadot #1970 at finalized Asset Hub block 23,614,037 uses relay governance block 34,040,240.
const staking = parseDecisionCurve({ LinearDecreasing: { length: "607142857", floor: "500000000", ceil: "1000000000" } });
const stakingTrack = { decisionPeriod: "403200", confirmPeriod: "1800" };
const snapshot = { now: 34040240, deciding: { since: 33887751, confirming: null } };
const progress = decisionProgress(snapshot, stakingTrack);
assert.equal(progress.remainingBlocks, 250711);
assert.equal(progress.endsAt, 34290951);
assert.ok(Math.abs(progress.share - 0.3781969246031746) < 1e-12);
assert.ok(Math.abs(decisionCurveThreshold(staking, progress.share) * 100 - 68.8543709077043) < 1e-10);
// Different measured speeds change only the ETA; the threshold has no wall-clock input.
for (const rate of [null, 2.0304, 5.88679245, 6.11320755]) {
  assert.match(onChainReferendumDeadline(snapshot, stakingTrack, rate), /ends at #34,290,951/);
  assert.equal(decisionProgress(snapshot, stakingTrack).share, progress.share);
}
assert.equal(onChainReferendumDeadline(snapshot, stakingTrack, null), "Decision period ends at #34,290,951");
assert.match(onChainReferendumDeadline(snapshot, stakingTrack, 6), /\(est\. 17 days\)/);
const confirming = { ...snapshot, deciding: { ...snapshot.deciding, confirming: snapshot.now + 100 } };
assert.equal(onChainReferendumDeadline(confirming, stakingTrack, 6), "Confirmation ends at #34,040,340 (est. 10 min)");
assert.equal(onChainReferendumDeadline({ ...confirming, now: confirming.deciding.confirming }, stakingTrack, 6), "Awaiting confirmation outcome");
const endedWindow = { ...snapshot, now: progress.endsAt + 1 };
assert.equal(decisionProgress(endedWindow, stakingTrack).share, 1);
assert.equal(onChainReferendumDeadline(endedWindow, stakingTrack, 6), "Awaiting decision outcome");
for (const invalid of [null, { now: snapshot.now, deciding: null }, { ...snapshot, now: NaN }, { ...snapshot, now: snapshot.deciding.since - 1 }]) {
  assert.equal(decisionProgress(invalid, stakingTrack), null);
  assert.equal(onChainReferendumDeadline(invalid, stakingTrack, 6), null);
}
for (const decisionPeriod of ["0", "28d", "garbage", "9007199254740993"]) assert.equal(decisionProgress(snapshot, { decisionPeriod }), null);
assert.equal(decisionProgress(snapshot, undefined), null);
// Index-only list countdowns must make their estimated nature explicit.
const listNow = 1_795_083_857_000;
const indexed = { status: "Deciding", timeline: [{ title: "Decision", at: new Date(listNow - 600_000).toISOString() }] };
assert.equal(referendumDeadline(indexed, { decisionPeriod: "200", confirmPeriod: "100" }, listNow, 6), "Est. decision end in 10 min");
assert.equal(referendumDeadline(indexed, { decisionPeriod: "200", confirmPeriod: "100" }, listNow, null), null);
assert.equal(referendumDeadline({ ...indexed, status: "Approved" }, stakingTrack, listNow, 6), null);

assert.equal(excerptTitle("  Bounty\n\ntitle  "), "Bounty title");
assert.equal(excerptTitle("Short title"), "Short title");
assert.equal(excerptTitle("a".repeat(160)), "a".repeat(160));
assert.equal(excerptTitle("a".repeat(161)), `${"a".repeat(160)}…`);
const essay = excerptTitle(`${"The problem with sandwiches is that they are structurally a lie. ".repeat(30)}`);
assert.equal(essay.endsWith("…"), true);
assert.equal(essay.length <= 161, true);
assert.equal(essay.startsWith("The problem with sandwiches"), true);
assert.equal(essay.includes("  "), false);
assert.equal(excerptTitle("Hello, world. ".repeat(40)).endsWith("…"), true);
assert.equal(excerptTitle("Hello, world. ".repeat(40)).endsWith(",…"), false);

assert.equal(formatDate("2026-11-20T12:23:00Z"), "Nov 20, 2026, 12:23 PM UTC");
assert.equal(formatDate("2026-01-01T00:00:00.000Z"), "Jan 01, 2026, 12:00 AM UTC");
assert.match(formatDate("2026-11-20T20:23:45+08:00"), /12:23 PM UTC$/);

console.log("format checks passed");

{
  const { detectWallets, proxyAllowsGovernance } = await import("../src/lib/wallets.ts");
  const none = detectWallets({ injected: [] });
  assert.deepEqual(none.map((w) => w.id), ["talisman", "subwallet-js", "polkadot-js"]);
  assert.ok(none.every((w) => !w.connectable));
  const some = detectWallets({ injected: ["polkadot-js", "subwallet-js", "my-wallet"] });
  assert.deepEqual(some.map((w) => w.id), ["subwallet-js", "polkadot-js", "my-wallet", "talisman"]);
  assert.equal(some.find((w) => w.id === "my-wallet").title, "My Wallet");
  const nova = detectWallets({ injected: ["polkadot-js"], nova: true });
  assert.equal(nova[0].title, "Nova Wallet");
  assert.equal(detectWallets({ injected: [], talismanEthOnly: true })[0].installed, true);
  assert.equal(detectWallets({ injected: [], inMimir: true }).some((w) => w.id === "mimir"), true);
  assert.equal(proxyAllowsGovernance("Governance"), true);
  assert.equal(proxyAllowsGovernance("Staking"), false);
  console.log("wallet detection ok");
}
assert.equal(walletCanSignOnChain("watch", null, "0xkusama"), false);
{
  const { localSearch } = await import("../src/lib/search-local.ts");
  const pages = [{ href: "/treasury/", label: "Overview", group: "Treasury" }, { href: "/referenda/whales/", label: "Whales", group: "Governance" }];
  assert.equal(localSearch("#1780", pages)[0].href, "/referenda/1780/");
  assert.equal(localSearch("15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5", pages)[0].href, "/user/15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5/");
  assert.deepEqual(localSearch("whal", pages).map((item) => item.href), ["/referenda/whales/"]);
  assert.deepEqual(localSearch("treasury", pages).map((item) => item.href), ["/treasury/"]);
  assert.equal(localSearch("", pages).length, 2);
  console.log("search helpers ok");
}
