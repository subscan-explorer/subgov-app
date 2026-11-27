---
type: Playbook
title: SubGov Operations & Tooling
description: Operational workflows, justfile automation, and development environment conventions for SubGov.
tags: [operations, automation, justfile, openwiki]
---

# SubGov Operations & Tooling

## Overview

Operational workflows in `subgov` currently center around repository hygiene, development environment standards, and automated documentation synchronization.

Readers should start at the [SubGov Quickstart](/openwiki/quickstart.md) for onboarding context, and refer to the [Documentation Catalog](/openwiki/README.md) for overall documentation structure.

## Tooling & Documentation Automation (`justfile`)

Repository maintenance and documentation runs are automated via `justfile` recipes that wrap the OpenWiki CLI while enforcing root directory hygiene:

- `just wiki-update [message="Update wiki."]`: Runs `openwiki code --update -p "{{message}}"` to synchronize documentation with recent changes, then removes generated root instruction files (`AGENTS.md`, `CLAUDE.md`) and default CI workflow files (`.github/workflows/openwiki-update.yml`), pruning empty `.github` directories.
- `just wiki-init`: Initializes repository documentation from scratch via `openwiki code --init` and executes the same root cleanup.

Direct CLI invocations remain available when running outside `just`:

- `openwiki code --update`: Scans the repository for recent code changes and updates the documentation tree.
- `openwiki code --init`: Re-initializes repository documentation from scratch.
- `openwiki --help`: Displays CLI usage, configuration options, and provider setups.

Guidance on onboarding is documented in the [SubGov Quickstart](/openwiki/quickstart.md). Implementation milestones and architectural standards follow the [SubGov 功能规划](/openwiki/subgov-plan.md).

## Workspace Hygiene & Conventions

The workspace follows explicit formatting rules enforced by repository configuration:

- **Formatting (`.editorconfig`)**:
  - Character set: UTF-8
  - End of line: LF (`\n`)
  - Indentation: 2 spaces
  - Trailing whitespace: Trimmed for code files, preserved for Markdown (`*.md`)
- **Ignored Files (`.gitignore`)**:
  - Environment files (`.env`, `.env.*`), excluding `.env.example`
  - Build outputs (`dist/`, `build/`, `out/`, `target/`, `coverage/`)
  - Dependencies (`node_modules/`, `vendor/`)
  - Log outputs (`logs/`, `*.log`)

To explore how these operational practices fit into the broader project structure, refer to the [Documentation Catalog](/openwiki/README.md).