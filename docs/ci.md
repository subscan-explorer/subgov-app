# CI and release configuration

`subscan-explorer/subgov-app` is the canonical source and CI repository. It has
an independent Git history; do not import branches or tags from the previous
repository.

## Validation

The CI workflow runs for pull requests, pushes to `main`, and manual dispatches.
Its GitHub-hosted `ubuntu-24.04` jobs use a read-only repository token:

- `Node checks`: frozen dependency installation, lint, types, tests, audit and
  production build.
- `Runtime image`: Docker build, pinned Node/pnpm verification and HTTP startup.
  The test image stays on the runner and is not pushed to a registry.
- `Secret scan`: Gitleaks over all fetched Git history, with redacted output.

All three checks and a review are required on `main`. Use the lockfile and
the Node/pnpm versions in the README when reproducing failures locally.

## Image publication

The separate Release workflow runs on GitHub-hosted `ubuntu-24.04` and publishes
only from `subscan-explorer/subgov-app`.
It uses the job's `GITHUB_TOKEN` with `packages: write`; no personal registry token
is required. Main pushes produce `latest`, full commit SHA and short SHA image
tags under `ghcr.io/subscan-explorer/subgov-app`. A stable Git tag promotes that
commit's previously built main image to the matching version tag. The workflow
does not create Git tags or update Kubernetes manifests.

`NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` is a repository Actions variable consumed
at build time. It is a public application identifier. Server API keys and DeGov
admin tokens belong in deployment secrets, never in public build variables.

Manual dispatch on `main` can publish a validated main commit without creating a
Git tag. The package remains private until its owner changes its visibility.

## Deployment

Flux manages both environments from the `pve` branch of the private
[`kubernetes-manifests`](https://github.com/subscan-explorer/kubernetes-manifests)
repository. Its SubGov manifest validation also uses GitHub-hosted
`ubuntu-24.04`, renders both overlays, and checks the image namespace, pinned
digests, and production policy alignment. CI does not connect to the cluster.

- Staging follows the highest Release run number in
  `ghcr.io/subscan-explorer/subgov-app:sha-<commit>-<run_number>`. Flux commits the
  selected image and digest to the operations repository, then deploys it.
- Production uses an explicitly reviewed
  `ghcr.io/subscan-explorer/subgov-app:git-<full-commit-sha>@sha256:<digest>`.
  Promote or roll back through one operations pull request updating the
  production deployment and the exact SHA matched by `subgov-app-production`.
  Main pushes and version image aliases do not automatically promote Production;
  no Git tag is required.

The active image source is `subgov-app` in the `staging` namespace. The active
policies are `subgov-app-staging` and `subgov-app-production` in `flux-system`.
The previous source and policies are explicitly suspended, and the previous
application repository's Actions are disabled.

Both environments use their existing `ghcr-imagepull` secret. Verify that it can
read a newly published private image before changing deployment references;
never commit registry credentials. Follow the operations repository's
[`subscan/subgov` guide](https://github.com/subscan-explorer/kubernetes-manifests/tree/pve/subscan/subgov)
for promotion and deployment checks. Change deployment YAML through GitOps,
without applying or patching the cluster directly.

Repository and package visibility are managed separately. Keep both private
until the owner completes review.
