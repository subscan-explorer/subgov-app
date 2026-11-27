# Treasury history and proposal details

Scope: SubGov frontend follow-up to the Subsquare comparison, based on main after PR #134. Verified on 2026-11-26 with authenticated, read-only Subscan API requests and public RPC. No transactions, backend data changes or deployment.

## Ownership corrections

- Treasury history exists in separate Relay and Asset Hub indexes. SubGov previously queried only Asset Hub. This is a frontend routing/pagination defect, not missing backend records.
- `/scan/governance/desc` already returns Fellowship #687's evaluation link and treasury spend #287's full description. SubGov now reads the appropriate governance kind and originating upstream.
- Polkadot referendum #1970 has no description on Subsquare either. Its requested payment is present in the proposal preimage.
- Remaining verified backend work is consolidated in [Subscan issue #6107](https://github.com/subscan-explorer/subscan/issues/6107): 99 missing records from one bounty batch, and separate child-bounty gross value / curator fee / net payout fields.

## Implementation

- Combine the current and historical spend ranges without scanning all pages. Check ordering, counts and the range boundary; fail visibly on incomplete/overlapping histories, with independent source views available. Each row carries its upstream. Explicit source links avoid same-ID ambiguity; direct legacy links fall back only when the current API has no record, never on authorization/network failures.
- Historical Relay records link to their originating explorer and do not mount Asset Hub payment reads/actions. An indexed payment attempt is not labeled as confirmed delivery.
- Decode requested treasury payments on the default referendum tab using exact codec JSON values. Resolve local asset metadata, preserve each transfer in nested batches, show unknown denominations as base units, and leave unavailable beneficiaries for Call inspection. Failed preimage reads preserve the finalized referendum state and decision clock.
- Show existing descriptions and fixed Subsquare source links for supported networks. Description failures remain distinct from empty descriptions; calls and timelines stay available.

## Verification

| Check | Result |
| --- | --- |
| Polkadot history API | Relay IDs 0–202: 203 records; Asset Hub IDs 203–287: 85 records; combined 288 |
| Kusama history API | Relay IDs 0–8: 9 records; Asset Hub IDs 9–26: 18 records; combined 27 |
| Polkadot list page 5 | Rendered IDs 207–188, crossing from current #203 to Relay #202; total 288 and 15 pages |
| Direct spend #0 | Rendered 69 USDT, Relay history badge, original description, and Relay block links; no payment action |
| Kusama source filter | All history shows 27; Relay filter shows 9, preserving chain/source in links |
| Referendum #1970 | Live preimage decodes 25,000,000,000 base units of Asset 1984, metadata USDt / 6 decimals; default tab renders 25,000 USDt and the encoded beneficiary |
| Spend #287 | Full description, Subsquare link, and existing Paid · awaiting settlement behavior rendered |
| Fellowship #687 | Description renders the evaluation PR link and Collectives Subsquare link |
| Responsive request summary | Desktop and 390 × 844 viewport inspected; document width 390, no horizontal overflow; amount, beneficiary, payout chain and source link readable |
| Local regression suite | Passed; includes exhaustive synthetic pagination of 288 records, boundary windows, source failures, overlapping IDs, missing-detail fallback, exact nested payments, unsafe-number rejection and preimage failure isolation |
| Lint / TypeScript / production build | Passed |

Rendered evidence is retained locally under `.local/subgov-local/followup/` (ignored; not a repository dependency). Existing UI components and page composition were retained. This is focused agent verification, not user design approval or production acceptance.

## Limits

- The combined list intentionally requires disjoint, descending ID ranges. If upstream histories later overlap, source-specific views remain usable; the combined view reports failure rather than inventing deduplication semantics.
- Request summaries cover decoded treasury spend/spendLocal/proposeSpend calls and nested call-tree nodes. Removed preimages, old runtime encodings and unrecognized remote assets remain explicitly unavailable/unknown. No amount is inferred from prose.
- Relay historical delivery is not reconstructed from archive/XCM evidence in the frontend. Missing child-bounty gross/fee data and absent bounty records require the backend issue.
- Staging/production deployment and signed transactions were not exercised.
