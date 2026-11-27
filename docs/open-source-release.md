# Preparing a public release

Keep this repository private until its owner completes publication review.
Code review, image publication, deployment and repository visibility are separate
actions. The canonical source and CI repository is `subscan-explorer/subgov-app`.

## Source and history

This repository starts from a reviewed source snapshot with an independent Git
history. It does not import the previous repository's branches, tags, pull requests,
release assets or container images. Original code retains Apache-2.0 and third-party
assets retain their own notices, including Inter's SIL OFL license.

Do not merge or mirror the previous history into this repository. That repository
retains hosted PR references to font binaries that were removed from its branch/tag
history. Port any outstanding work as reviewed source changes onto this repository's
current main branch. Historical documents may refer to the previous repository;
those links do not make its private content part of this repository.

Before publication, verify all reachable refs and the current tree contain no old
font binaries, credentials, local environment files, build output or dependencies.
Review the licenses and checksums in `public/fonts` and the generated third-party
dependency notices. Keep private backups outside the publication repository.

## Repository and CI

- Keep default Actions permissions read-only, require `Node checks`, `Runtime
  image` and `Secret scan`, and require review on `main`.
- Use GitHub-hosted runners. Forks cannot publish upstream images with the
  supplied Release workflow.
- Enable Dependabot alerts and security updates. Enable GitHub-native secret
  scanning and push protection when available under the existing plan; Gitleaks
  CI provides a full-history scan without activating a paid product.
- CI validation does not publish images. Release uses the new image namespace;
  adopting it in a deployment is a separate operator change.
- Review this repository's own PRs, artifacts, release assets and image contents
  before making them public. A clean initial history does not replace future review.

## Verification

Run a frozen install, lint, typecheck, tests, dependency audit, production build
and container smoke checks. Verify the setup instructions without private credentials
and check desktop/mobile layouts in both themes when changing the interface.
Do not perform chain transactions as a publication test.

Only the repository owner should change visibility after completing review.
