# SubGov

The canonical source and CI repository is
[subscan-explorer/subgov-app](https://github.com/subscan-explorer/subgov-app).

A multi-chain governance portal for Polkadot, Kusama and Paseo. SubGov reads
indexed governance data from Subscan, reads live state from public chain RPCs,
and lets connected wallets sign governance transactions. Referendum comments use
an optional DeGov service. This repository contains the Next.js application;
it does not contain the Subscan indexer or DeGov backend.

## Quick start

Use Node.js **24.22.1** and pnpm **11.24.0**, matching `.nvmrc`, `package.json`,
Docker and CI. Dependencies are locked in `pnpm-lock.yaml`.

```bash
nvm install
nvm use
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
# Set SUBSCAN_API_KEY in .env before continuing.
pnpm dev
```

Open [localhost:3000](http://localhost:3000). Obtain a Subscan API key through
[Subscan's developer platform](https://pro.subscan.io/) and configure it in `.env`. Direct Subscan access requires an active API plan; see the [official access guide](https://support.subscan.io/doc-360177).
Subscan is the default provider in both development and production. Without a
key, the application can start, but indexed pages display an unavailable/configuration
state. A successful HTTP response alone does not mean governance data loaded.

The built-in networks use Asset Hub for current governance and relay-chain
sources where historical records require them. Endpoint availability depends on
the provider and network. Missing data is not replaced with mock governance data.
See [data sources](docs/api.md) for the integration boundaries.

## Configuration

| Setting | Purpose |
| --- | --- |
| `SUBSCAN_API_KEY` | Server-only Subscan credential; required for the default provider. |
| `SUBSCAN_API_SOURCE` | `subscan` (default), `pubfi`, or `cluster`. |
| `PUBFI_API_KEY` | Server-only credential for the legacy network-prefixed `pubfi` gateway integration. Verify that your provider supports these routes before selecting it. |
| `SUBSCAN_CLUSTER_BASE_URLS` | Complete upstream URL map for an operator's own cluster; see `.env.example`. |
| `SUBGOV_DEV_ORIGINS` | Optional comma-separated extra development hostnames. |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Optional public project ID from [WalletConnect](https://dashboard.reown.com/). Extension wallets work without it. |
| `NEXT_PUBLIC_DEGOV_DISCUSSION_API` | Browser-accessible DeGov GraphQL endpoint. |
| `NEXT_PUBLIC_DEGOV_DISCUSSION_SPACE` | Your registered DeGov discussion space. |
| `DEGOV_DISCUSSION_API` | Server-accessible endpoint for the same DeGov service. |
| `DEGOV_DISCUSSION_ADMIN_TOKEN` | Optional server-only token for provisioning missing discussion targets. |

Keep `.env` out of version control. Never put API keys or admin tokens in
`NEXT_PUBLIC_*` variables: those values are embedded in the browser bundle.
Set public variables **before building**, then rebuild when they change.

DeGov comments require a space configured with your exact browser origins:
`http://localhost:3000` for development, `http://localhost:3015` for Compose, and
your deployed origin. Replace `your-space` in `.env`. The upstream `subgov` space
is not automatically available to forks. Read-only governance and wallet
transactions work independently of comment authentication. DeGov authentication
uses a wallet message signature; it does not submit an on-chain transaction.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm audit
pnpm build
pnpm start --hostname 127.0.0.1 --port 3015
```

The default tests are local regressions for data routing, formatting, comments,
voting, accounts, treasury history and client state. They do not sign or submit
transactions. The following network checks are optional and outside PR CI:

- `pnpm test:proposal`: reads Paseo metadata and prepares unsigned calls.
- `pnpm test:governance-rpc`: verifies chain identity, reads storage and prepares
  unsigned calls on the configured Asset Hubs.
- `pnpm test:pubfi`: reads the selected gateway with a locally configured key.

## Docker

```bash
docker compose up --build
```

Compose reads `.env` and serves the app on [localhost:3015](http://localhost:3015).
To build and run without Compose:

```bash
docker build -t subgov:local .
docker run --rm --env-file .env -p 127.0.0.1:3015:3015 subgov:local
```

Pass any `NEXT_PUBLIC_*` settings as Docker build arguments when using `docker
build` directly; runtime `--env-file` cannot replace values already compiled into
the browser bundle. Do not pass server credentials as build arguments.

CI runs on pull requests and pushes to `main` using GitHub-hosted runners.
The upstream release workflow publishes images for `subscan-explorer/subgov-app`
to `ghcr.io/subscan-explorer/subgov-app`; forks must configure their own publishing.
Main pushes build images, and stable tags promote an already built main image.
The workflow does not create Git tags. Operators maintain deployment configuration
separately and must explicitly adopt the new image namespace before it can update
an existing deployment. See [CI and release configuration](docs/ci.md).

## Project layout

- `src/app`, `src/components`: routes and interface.
- `src/lib/subscan-*.ts`, `src/lib/pubfi.ts`: server-side data clients.
- `src/lib/chain-api.ts`, `src/lib/vote.ts`: RPC and wallet transaction handling.
- `src/lib/mock`, `src/lib/api.ts`: legacy fixtures, not the live data provider.
- [DESIGN.md](DESIGN.md): interface conventions.
- [CONTRIBUTING.md](CONTRIBUTING.md): development and review workflow.
- [SECURITY.md](SECURITY.md): private vulnerability reporting.

Historical research and acceptance records under `openwiki/` and `docs/reviews/`
are dated snapshots, not statements of current production behavior.

## License

Original SubGov code is licensed under [Apache-2.0](LICENSE).
Inter is licensed under [SIL OFL 1.1](public/fonts/OFL.txt). Dependencies and network
branding retain their own terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
