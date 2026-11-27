# CI and release configuration

`subscan-explorer/subgov-app` is the canonical source and CI repository. It has
an independent Git history; do not import branches or tags from the previous
repository.

## Validation

The CI workflow runs for pull requests, pushes to `main`, and manual dispatches.
Its GitHub-hosted jobs use a read-only repository token:

- `Node checks`: frozen dependency installation, lint, types, tests, audit and
  production build.
- `Runtime image`: Docker build, pinned Node/pnpm verification and HTTP startup.
  The test image stays on the runner and is not pushed to a registry.
- `Secret scan`: Gitleaks over all fetched Git history, with redacted output.

All three checks and a review are required on `main`. Use the lockfile and
the Node/pnpm versions in the README when reproducing failures locally.

## Image publication

The separate Release workflow publishes only from `subscan-explorer/subgov-app`.
It uses the job's `GITHUB_TOKEN` with `packages: write`; no personal registry token
is required. Main pushes produce `latest`, full commit SHA and short SHA image
tags under `ghcr.io/subscan-explorer/subgov-app`. A stable Git tag promotes that
commit's previously built main image to the matching version tag. The workflow
does not create Git tags or update Kubernetes manifests.

`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is a repository Actions variable consumed
at build time. It is a public application identifier. Server API keys and DeGov
admin tokens belong in deployment secrets, never in public build variables.

The repository was initialized while Actions were disabled, then validated with
the CI workflow only. Initial migration does not publish an image or create a tag.
Future main pushes retain the configured automatic Release behavior.

## Deployment adoption

The new image namespace is independent of `ghcr.io/subscan-explorer/subgov`.
Existing deployment image references and image-update policies may still use the
previous namespace. Publish and verify an appropriate new image before updating
those operator-managed references. Keep repository/package visibility private
until the owner completes review. Repository visibility and package visibility
are managed separately.
