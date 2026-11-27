# Data sources and API boundaries

SubGov is a server-rendered Next.js frontend. It does not implement a standalone
SubGov REST backend. Its indexed data comes from Subscan; live storage and
transactions use public chain RPCs; referendum comments use DeGov GraphQL.
The former mock REST proposal is not the deployed API contract.

## Indexed governance: Subscan

`src/lib/subscan-request.ts` resolves the configured provider and authentication.
`src/lib/pubfi.ts` is the server-only HTTP client despite its historical filename.
It supports three modes:

| Mode | Base URL | Authentication |
| --- | --- | --- |
| `subscan` (default) | `https://{upstream}.api.subscan.io` | Server-side `X-API-Key`. |
| `pubfi` | `https://api.pubfi.ai/v1/gateway/subscan/{upstream}` | Server-side bearer token. |
| `cluster` | Operator-provided `SUBSCAN_CLUSTER_BASE_URLS` map | Network access controlled by the operator. |

Paths are under `/api/`; indexed list requests normally use POST bodies with
zero-based `page` and `row` capped at 20. Consult the owning `src/lib/subscan-*.ts`
module for each endpoint's exact fields and response handling. Provider reference:
[Subscan API documentation](https://support.subscan.io/).

Current governance uses the Polkadot, Kusama and Paseo Asset Hubs. Historical
records can require relay-chain sources, and Fellowship uses Collectives where
appropriate. Record IDs can overlap across sources; retain the upstream when
linking or resolving historical records.

Server actions in `src/lib/gov-actions.ts` expose specific public-data reads to
client components without exposing API credentials. Provider errors, missing
records and endpoints not yet available on a network remain distinct states.
Neither an HTTP 200 nor an empty list alone establishes backend completeness.

## Live state and transactions: chain RPC

Network RPC URLs and expected genesis hashes live in `src/lib/chains.ts`.
`src/lib/chain-api.ts` connects with Polkadot.js `WsProvider` and verifies the
selected chain. It does not use the optional Substrate Connect light client.

Wallet extensions or WalletConnect provide the signer. The frontend prepares
and submits user-approved extrinsics, handles finality and refreshes state.
It does not store wallet seeds or private keys. WalletConnect requires the public
project ID documented in the README; extension wallets do not.

## Comments: DeGov

`src/lib/discussion.ts` is the GraphQL transport; `src/lib/discussion-server.ts`
looks up or provisions discussion targets. Message-signed sessions are handled
by `src/hooks/use-discussion-session.ts`. Comment writes are off-chain and use
the user's authenticated session, not the provisioning admin token.

Forks need their own space and exact allowed browser origins. Build-time public
settings and server-only provisioning credentials are described in `.env.example`.
Missing comment configuration does not prevent reading indexed governance data.

## Fixtures and historical documents

`src/lib/mock/` and `src/lib/api.ts` retain legacy fixtures used by some helpers
and tests. They are not a replacement backend or an automatic fallback for failed
live requests. Dated documents under `docs/reviews/` and `openwiki/` may describe
past behavior, retired routes or backend work that was incomplete at that time.
