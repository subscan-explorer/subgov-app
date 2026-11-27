---
type: Guide
title: SubGov Quickstart
description: Getting started guide, project overview, and knowledge base entrypoint for SubGov.
tags: [quickstart, overview, bootstrap, governance]
---

# SubGov Quickstart

> Historical project planning snapshot. Follow [README.md](../README.md) for current setup, supported networks and live integrations.

## Overview

`subgov` is a multi-chain governance portal for the Substrate and Polkadot ecosystems, modeled after SubSquare. The project aims to index and standardize on-chain governance data across 50+ chains while providing proposal discussions, identity verification, delegation, and wallet voting workflows.

At this stage, the repository contains foundational research, phased functional specifications, project governance configuration, and automated documentation tooling. Implementation follows a staged roadmap:

- [SubSquare 调研报告](/openwiki/subsquare-research.md): Benchmark analysis of SubSquare's product capabilities, multi-chain settings, REST/GraphQL APIs, and open-source scanner ecosystem.
- [SubGov 功能规划](/openwiki/subgov-plan.md): Phased delivery roadmap (P0–P4) and core architectural principles (data source isolation, 4-tier data models, configuration-driven multi-chain, and SiMa Web3 signing).
- [SubGov Operations & Tooling](/openwiki/operations.md): CI automation via GitHub Actions, development environment standards (`.editorconfig`, `.gitignore`), and OpenWiki CLI usage.
- [SubGov Documentation Catalog](/openwiki/README.md): Root catalog linking all knowledge base documents and upstream ecosystem references.

## Repository Layout

The current repository layout consists of configuration, documentation, and automation infrastructure:

- `.editorconfig`: Specifies workspace formatting (UTF-8, 2-space indentation, LF line endings, trailing whitespace trimming).
- `.gitignore`: Configures exclusion rules for environment secrets (`.env*`), log files (`logs/`, `*.log`), dependencies (`node_modules/`, `vendor/`), build artifacts (`dist/`, `build/`, `target/`), and local editor files.
- `justfile`: Automation command recipes (`wiki-init`, `wiki-update`) that wrap OpenWiki execution and enforce repository root hygiene.
- `/openwiki/`: Knowledge base tracking research, roadmap specifications, architecture, and operational tooling.

## Guidance for Future Agents

When bootstrapping code in this repository:

1. **Follow the Roadmap**: Ground new implementations in the staged deliverables defined in [SubGov 功能规划](/openwiki/subgov-plan.md), beginning with P0 (Multi-chain Config, Chain Adapter, Runtime Decoder, and Indexer).
2. **Scaffold with Conventions**: Follow formatting rules defined in `/.editorconfig` (2 spaces, LF line endings). Respect directory rules in `/.gitignore`. Operational conventions are detailed in [SubGov Operations & Tooling](/openwiki/operations.md).
3. **First Commit**: The Git repository currently has no commits on the `main` branch. When committing code, verify git staging to avoid committing untracked environment or build artifacts.
4. **Keep Docs in Sync**: Run `just wiki-update` (or `openwiki code --update`) whenever adding new domain models, packages, or major components, keeping docs synchronized as detailed in [SubGov Operations & Tooling](/openwiki/operations.md).

## Backlog

The following implementation areas are tracked in [SubGov 功能规划](/openwiki/subgov-plan.md) and deferred until functional code is added:

- **Application Architecture** (`/src/`): Planned as P0 Infrastructure (Multi-chain Config, Chain Adapter, Runtime Decoder, Indexer) in [SubGov 功能规划](/openwiki/subgov-plan.md).
- **Domain Logic** (`/src/domain/`): Planned across P0 (OpenGov Referenda, Tracks, Treasury) and P1–P3 in [SubGov 功能规划](/openwiki/subgov-plan.md).
- **API and Interface Surface** (`/src/api/`): Planned as P0 REST/GraphQL query APIs and frontend overview in [SubGov 功能规划](/openwiki/subgov-plan.md).
- **Testing and Verification** (`/tests/`): Deferred until P0 indexing and chain adapter implementation begins.