# SubGov Justfile

dev:
    pnpm exec next dev --turbopack

build:
    pnpm build
serve:
    pnpm start --hostname 0.0.0.0 --port 3015

# OpenWiki: initialize wiki from scratch
wiki-init:
    openwiki code --init -p "Initialize wiki for subgov project."
    -rm -f AGENTS.md CLAUDE.md
    -rm -rf .github/workflows/openwiki-update.yml
    -find .github -type d -empty -delete 2>/dev/null

# OpenWiki: update existing wiki
wiki-update message="Update wiki.":
    openwiki code --update -p "{{message}}"
    -rm -f AGENTS.md CLAUDE.md
    -rm -rf .github/workflows/openwiki-update.yml
    -find .github -type d -empty -delete 2>/dev/null
