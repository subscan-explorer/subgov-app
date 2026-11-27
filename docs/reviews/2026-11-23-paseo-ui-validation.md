# Paseo transaction and UI validation — 2026-11-23

This follows the [initial review of PRs #121–#128](2026-11-23-pr-validation.md). The initial fixes landed in #129; this follow-up starts from `363d3203dd1bdb21492efe0d2f09999ae7cba001`. No deployment or merge was performed by this validation session.

## Method and scope

The user authorized a dedicated test account and funded it with 5,000 test PAS on Paseo Asset Hub. The harness executes SubGov's actual transaction builders, signer adapter and finality pipeline, using a local test signer. The secret remains in macOS Keychain and is never included in the repository or browser. This verifies real dispatch and application integration, but does not exercise a browser extension's approval window, WalletConnect transport, Nova or Mimir.

- Network genesis: `0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2`.
- Main test account: `5GpePZkwtdFBoHxDJN5GAkNob2oyhkahJGD2UY3jx6dpYPvi`.
- Controlled actor: `5ER9Vu3UXtAaym5ubVXLg8YNEvHF5AHanSW1nduQr3csAqPB`; only 2 PAS was transferred to it for proxy tests.
- Controlled referendum: [Paseo Asset Hub #160](https://assethub-paseo.subscan.io/referenda_v2/160), SmallTipper, proposing a 0.01 PAS `treasury.spendLocal` to the test account. It has no test votes remaining.
- Each signed operation checks the network and caps its estimated fee at 0.1 PAS. Finalized receipts and the resulting storage are recorded. A journal prevents blind replay after interruption.
- Browser observations use staging with a watch-only account. Transactions run outside that browser; navigation/reload then checks the rendered result. Browser-driven signing and automatic InBlock/Finalized rendering after a UI submission are not claimed.

## Real-chain execution

Passed: standalone preimage note/unnote and deposit release; isolated referendum submission and call decoding; Standard Aye/Nay, conviction replacement, Split and SplitAbstain; removeVote plus unlock; delegation, replacement, a second track, batch undelegation and unlock; zero-delay Governance proxy voting and removal. The proxy test used the real account's full votable balance, verified that the real account was the voter and retained its free balance, and that the signer paid the fee. Proxy permissions were removed afterward.

One initial harness assertion was wrong: it assumed that a referendum's Lookup proposal automatically made the preimage `Requested`. The actual preimage remained `Unrequested`; unnote succeeded and removed its bytes. The journal retains this failed assertion and its successful transaction receipt. The same preimage was then restored and verified. **Requested-preimage byte retention was not live-tested.** Do not replay the failed step or count it as proof of that scenario.

## Browser reconciliation

| Scenario | Chain state | Observed UI |
| --- | --- | --- |
| Aye, 1.25 PAS at 2x | Aye 2.5, Nay 0, support 1.25; lock 1.25 | Staging tally and My votes matched; one vote, 1.25 PAS locked. |
| Split, Aye 0.3 / Nay 0.2 PAS | Weighted Aye 0.03, Nay 0.02, support 0.3 | Staging tally and ballot matched. Lock remained 1.25, with 0.75 unlockable, correctly reflecting the retained class lock. |
| SplitAbstain, Aye 0.2 / Nay 0.1 / Abstain 0.7 PAS | Weighted Aye 0.02, Nay 0.01, support 0.9 | Staging tally showed 66.7% approval and support 0.9. My votes showed all three amounts, lock 1.25 and 0.25 unlockable. |
| Remove vote and unlock | No vote; frozen balance 0; tally 0/0/0 | Staging My votes showed zero votes, zero locked and zero unlockable. |
| Delegate, then undelegate/unlock | Track 30, 1.5 PAS at 0.1x to the controlled actor; then no delegation or lock | Staging My delegations showed the exact amount, conviction and target, then “not delegating on any OpenGov track”. |
| Preimage removal and recovery | Standalone remark bytes absent; proposal bytes restored | Staging showed the remark as Cleared and its decoder reported no stored bytes. The proposal was Unrequested and decoded to `treasury.spendLocal(100000000, test account)`, equivalent to 0.01 PAS. |
| Premature refund | Controlled referendum remains ongoing | Staging My deposits explicitly reported the index unavailable; querying #160 directly reported no refundable deposits. |
| Decision deposit | 1 PAS decision deposit, 10 PAS submission deposit; Deciding since Relay block 2,065,662 | Staging initially mixed live deciding metadata with cached Preparing/0 PAS. Fixed local build reconciled both panels to Deciding/1 PAS and removed the redundant placement button. |
| Indexing gap | Connected account had a current vote while indexed data was old/empty | Reproduced on staging. Fixed local production build showed the real three vote legs despite a deliberately empty index, with an index-delay notice. |
| Governance duration | 100,800 governance blocks; roughly 6 seconds per Relay block | Staging incorrectly showed 2.4 days / 3 minutes. Fixed local build showed approximately 7 days / 10 minutes. |

The local production-build check uses an explicitly labeled synthetic Subscan detail/empty-index fixture for #160; its tally, account vote and clock reads use **real Paseo RPC data**. This demonstrates the repair without claiming that the repair has been deployed. Other voters and global indexed counts still depend on the index; a single account RPC read cannot establish the global voter count.

## Follow-up fixes

1. **P2 — Wrong governance clock.** OpenGov periods after migration use the Relay block provider, while the UI multiplied periods by Asset Hub's roughly 2-second local production time. Measure timestamp deltas against the same Relay/local provider used by `governanceBlockNumber`, cache for five minutes, and use it for referendum deadlines and track periods. An unavailable clock displays block counts; a four-second page budget avoids waiting for a cold metadata connection. Three-chain live smoke tests measured approximately 6.00 s (Polkadot), 6.24 s (Kusama), and 5.94 s (Paseo) at the sampled blocks. These are estimates, not fixed future block times.
2. **P2 — Stale current-account vote after reload.** Load the connected/watch-only account's vote on mount and focus, isolate responses by account as well as chain/referendum, and expose the result even when the index request fails. Preserve the index's global count and label its possible delay.
3. **P2 — Misleading vote details.** An RPC read does not provide a vote timestamp; stop rendering the read time as the cast time. Show an unknown time instead. Label Abstain as support-only, and label its bubble size as support. A sum from the displayed vote rows is explicitly labeled “Abstain in shown votes”, not presented as the complete referendum abstain total.
4. **P2 — Stale status and deposits after finality.** The metadata panel read the live deciding block but kept status and deposit amounts from the index. Reconcile these fields from one storage response on mount/focus/governance changes, with scope and response isolation. Decode proposal bytes only for the relevant tabs, and retain indexed execution outcomes because referendum storage remains Approved after enactment.
5. **P3 — Overstated summaries and watch-only wording.** Treasury's five-record sample is now labeled as a sample, rather than an all-network total/empty result. An indexed approval rate no longer implies that votes exist. Watch-only accounts are no longer labeled signing accounts or told to reconnect WalletConnect when delegating or previewing a proposal.

## Remaining acceptance requirements

| Area | Remaining work |
| --- | --- |
| SubWallet, Nova, Mimir, WalletConnect | Real wallet connection/restoration, signer/real-account selection and confirmation windows. Requires the corresponding wallet environment; the local signer does not certify it. |
| UI transaction lifecycle | Check pending, inclusion, finality, rejected signature and error UI through a real wallet. Transaction library lifecycle and state-hook regressions passed separately. |
| Submission/decision deposit refunds | Successful refunds require the controlled referendum to end. An ongoing referendum must not offer/refund these deposits. |
| Requested preimage | Need a real `Requested` ticket for the owner-refund/retained-bytes scenario. Existing unit coverage is not live-chain proof. |
| Treasury payout/checkStatus | Need an approved, controlled `treasury.spends` record and destination-chain receipt verification. The `spendLocal` proposal is not that record. |
| DeGov | Own-account message-signing, comment edit/delete and preserved replies remain a separate acceptance flow. No public comment was posted by this test. |
| Statistics, deposits index, calendar, nested votes and unsupported filters | Explicit backend dependencies remain pending. Rendering an unavailable notice is not acceptance of missing data. |

Validation: lint, TypeScript, all nine default test suites and production build passed. Added regressions cover account switching during a live vote read, refresh on focus/finality, unchanged indexed totals, absent vote timestamps, live deposits/status and Relay-vs-local clock conversion. Read-only live governance smoke tests passed on all three supported Asset Hubs. All nine proposal templates were prepared against the real Paseo runtime, including the restored registered preimage. All nine also reached the staging browser review screen with matching call names/hash/length and disabled watch-only signing; switching templates or editing input removed the previous preview, and invalid call hex was rejected with a visible validation error. The native treasury preview reproduced the exact 39-byte hash used by #160, and the Remark/New preimage paths produced the same 32-byte call/hash. Only the small native-treasury proposal was actually submitted. The follow-up local production build also visibly showed the corrected watch-only proposal guidance.

## Cleanup and evidence

The final independent RPC audit verified **30 finalized extrinsics**, all with `system.ExtrinsicSuccess`; proxy dispatches also returned `ProxyExecuted(Ok)`. The preimage assertion failure above is retained as a failed *scenario assertion*, not disguised as a successful requested-preimage test. [Public receipts and final storage](2026-11-23-paseo-receipts.json) include every transaction hash and block.

- Main free balance: **4,988.5605839922 PAS**; reserved: **11.40103 PAS**; voting frozen: **0 PAS**.
- Reserved funds: 10 PAS submission deposit + 1 PAS decision deposit + 0.40103 PAS preimage ticket.
- All test votes/delegations/proxies removed. The actor account has zero free/reserved balance and no locks. Referendum tally is 0/0/0.
- Total balance reduction from the 5,000 PAS funding: **0.0383860078 PAS**, covering fees and any account-reaping effects. The reserved amount remains held, not spent.
- The controlled referendum remains ongoing and the proposal preimage is intentionally retained. Refunds are future work after the runtime permits them; no refund is claimed now.

The expanded inventory and actionable remaining manual cases are in [the complete acceptance matrix](2026-11-23-full-acceptance.md). It distinguishes automatic verification, partial coverage, backend/runtime prerequisites, wallet-only checks and post-deployment checks across all 45 page routes.
