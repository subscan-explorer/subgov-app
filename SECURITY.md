# Security

Security fixes target the current `main` branch. Older tags are not guaranteed
to receive backports. Use the current lockfile and review dependency advisories
before deploying your own instance.

## Reporting a vulnerability

Report vulnerabilities privately through
[GitHub private vulnerability reporting](https://github.com/subscan-explorer/subgov-app/security/advisories/new)
when that option is available. While the repository is private, use a private
repository advisory or contact a repository maintainer through an established
private channel. Do not put exploit details, credentials, wallet seeds or
unredacted request logs in a public issue.

Include the affected commit, reproduction steps, impact and redacted evidence.
Use a local instance or testnet. Do not test denial-of-service or signing attacks
against production services or move funds to demonstrate a report.

## Deployment responsibilities

- Keep Subscan and DeGov admin credentials server-side; rotate any exposed key.
- Configure your own DeGov space and allowed origins, and your own WalletConnect
  project. Public build variables are not secrets.
- Keep external PR jobs separate from deployment infrastructure. The provided CI
  uses GitHub-hosted runners and scans Git history for secrets with Gitleaks.
- Protect the default branch and release tags. Require CI and review before
  merging, and keep the default GitHub Actions token permissions read-only.
- Enable GitHub secret scanning and push protection where your plan permits it.
  Private repositories may need a paid entitlement; the included Gitleaks job
  does not require that entitlement.

See [the publication checklist](docs/open-source-release.md) before changing
repository visibility. Removing a sensitive or restricted file from the current
tree does not remove it from Git history, old tags, PRs, logs or release assets.
