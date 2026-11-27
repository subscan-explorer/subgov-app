# Contributing

Start with the [README](README.md) and use its pinned Node.js and pnpm versions.
Create a focused branch, keep credentials in an ignored `.env`, and use your own
API credentials and DeGov space. Do not commit wallet seeds, private keys,
production configuration, API responses containing private data, or session logs.

Before opening a pull request, run `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm audit`, and `pnpm build`. Include the behavior change and the checks you ran.
Describe any live-network checks separately. Tests and previews must not sign
transactions or post comments without explicit authorization.

For interface changes, follow [DESIGN.md](DESIGN.md), check desktop and mobile,
and verify light/dark themes and relevant loading, empty and error states.
Keep wallet signing, chain identity checks and token precision intact.

Use public, reproducible configuration examples. Preserve the notices and
licenses of third-party assets. New dependencies must be reviewed for security,
license compatibility and whether they enter the distributed application.
The default dependency tree deliberately excludes unused Substrate Connect
light-client packages; SubGov connects through `WsProvider`.

Pull requests run on isolated GitHub-hosted runners with read-only repository
permissions. Do not change PR workflows to use internal/self-hosted deployment
runners or expose secrets to fork code. Maintainers review changes to workflows,
dependencies and publication configuration before merging.

By submitting a contribution, you agree that your original contribution is
provided under this project's Apache-2.0 license. Do not submit material you
lack permission to distribute under its stated terms.
