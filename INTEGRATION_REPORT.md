# SubGov PubFi/Subscan Integration Report

> Historical snapshot from September 2026. Routes and integration behavior below may be obsolete. Start with [README.md](README.md) and [docs/api.md](docs/api.md) for current setup.

Generated: 2026-09-17 (final)

## Summary

SubGov has been migrated from a static mock portal to a server-rendered live data workspace. All `page.tsx` routes no longer import `@/lib/api` or `@/lib/mock`. Pages with Subscan coverage show live indexed data; pages without coverage show explicit Coming soon, Empty, or account-scoped lookup states.

## Infrastructure

| Component | Status | Notes |
|-----------|--------|-------|
| `src/lib/pubfi.ts` | ✅ | Server-side PubFi client; key from `PUBFI_API_KEY` |
| `src/lib/subscan-data.ts` | ✅ | OpenGov referenda + tracks |
| `src/lib/subscan-treasury.ts` | ✅ | Treasury spends, proposals, bounties, tips |
| `src/lib/subscan-network.ts` | ✅ | Validators, pools, assets (statemint) |
| `src/lib/subscan-archive.ts` | ✅ | Council, democracy, techcomm, fellowship, preimages, scheduler, multisigs, search |
| `src/lib/subscan-governance.ts` | ✅ | Whales, delegation detail, proxies, vesting |
| `src/app/api/subscan/[network]/[...path]/route.ts` | ✅ | Proxy for browser/client calls |
| Networks | ✅ | `polkadot`, `kusama`, `statemint` |
| `pnpm test:pubfi` | ✅ | 8 endpoint smoke checks |
| `pnpm build` | ✅ | Production build passes |

## Live pages (49)

### Governance
| Route | Subscan endpoint | Notes |
|-------|------------------|-------|
| `/` | `scan/referenda/referendums` | |
| `/referenda/` | `scan/referenda/referendums` | |
| `/referenda/{id}/` | `scan/referenda/referendum` | |
| `/referenda/tracks/` | `scan/referenda/tracks` | |
| `/referenda/tracks/{id}/` | tracks + referenda filter | |
| `/referenda/whales/` | `scan/referenda/votes` | Top votes on current deciding referendum |
| `/delegation/{address}/` | `scan/referenda/delegate` + `scan/referenda/delegates` | Per-address lookup |

### Treasury, Network, Archive, Protocol tools
(Same as prior report — spends, bounties, staking, council, democracy, techcomm, fellowship referenda, preimages, scheduler, multisigs, assets on statemint, search identity)

### Account-scoped live lookups
| Route | Subscan endpoint | Notes |
|-------|------------------|-------|
| `/proxies/?address=` | `scan/proxy/extrinsics` | Requires account query param |
| `/vesting/?address=` | `scan/vesting_release` | Last 45 days; requires account query param |
| `/account/` | `v2/scan/account/tokens` | Via API proxy when wallet connected |

## Intentional non-live pages

| Route | Reason |
|-------|--------|
| `/delegation/` | Subscan has no global delegate directory; only per-address lookup |
| `/whitelist/` | No matching PubFi Subscan route |
| `/referenda/dv/` | No DV cohort endpoint on connected provider |
| People, Community, Coretime, legacy councils | Off-chain or no list endpoint |

## Mock removal audit

```
page.tsx files importing @/lib/api or @/lib/mock: 0
Orphan mock view components: removed (delegation, tracks, user views)
```

## Test results

### API smoke (`pnpm test:pubfi`)
```
ok GET now
ok POST scan/referenda/referendums
ok POST scan/treasury/proposals
ok POST scan/staking/validators
ok POST scan/council/proposals
ok POST scan/preimage/list
ok POST scan/schedulers
ok POST scan/referenda/votes
```

### HTTP smoke (localhost:3015) — all 200
`/`, `/referenda/`, `/referenda/whales/`, `/treasury/spends/`, `/staking/`, `/council/`, `/preimages/`, `/scheduler/`, `/multisigs/`, `/assets/`, `/search/?q=Alice`, `/archive/`, `/delegation/15G6MdGUR5CCNb87RkBjEHr3fe7cm2qML27a7idLj9qbJ6gK/`, `/proxies/?address=…`, `/vesting/?address=…`

### Browser
`playwright-cli` failed in this environment (Chromium sandbox as root). HTTP + HTML content checks used instead; live pages render expected headings without mock placeholders.

## Remaining gaps (out of scope for this integration)

1. Chain selector does not yet propagate to server fetches (defaults: polkadot, statemint for assets).
2. No server-side response caching (all `cache: "no-store"`).
3. Referendum detail votes/comments not enriched from Subscan votes endpoint.
4. `gov.tsx` / `app-state.tsx` still use mock for wallet demo and local vote state (UI shell only, not page data).
