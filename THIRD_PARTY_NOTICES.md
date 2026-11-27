# Third-party notices

The Apache-2.0 license applies to original SubGov code. It does not relicense
third-party software, fonts or trademarks. Preserve the notices below and the
licenses shipped with dependencies when redistributing source or built images.

## Font

Inter 4.1 is Copyright (c) 2016 The Inter Project Authors and is distributed under
the SIL Open Font License 1.1. The unmodified WOFF2, full license, source URL and
checksums are in [public/fonts](public/fonts/README.md).

## Application dependencies

`pnpm build` generates `public/third-party-licenses.txt` from the **installed
production dependency graph**, including exact versions, declared licenses,
source locations, authorship where supplied, and complete license texts. This
file is served with the built site and included in its image. It is generated
on the target platform, so platform-specific Next.js packages are represented.
Run `pnpm licenses:generate` separately to inspect it before building.

Most dependencies use MIT, Apache-2.0, ISC or BSD licenses. The browser support
data in `caniuse-lite` uses CC-BY-4.0. Native compiler packages and their upstream
licenses are included as appropriate for the build platform. The generator fails
if a new dependency does not include a complete license text and has no reviewed
upstream fallback. Review any new license instead of silently exempting it.

Some published packages omit their upstream license file. Copies from their
published source commits live under `licenses/third-party`; provenance is recorded
in `sources.json`. Next.js subpackages share the framework's MIT license. React's
`client-only` marker package retains React's MIT notice. `encode-utf8` and
`uint8arrays` declare MIT in their package metadata; the generator retains their
available README/author information and includes the standard MIT terms.

The dependency tree excludes unused `@talismn/connect-wallets` and Polkadot.js's
optional `@substrate/connect` light-client packages. Wallet extension support uses
the injected extension interface and chain connections use `WsProvider`.
Next.js image optimization is disabled, so its unused optional `sharp` native
processor is also excluded. Re-enabling those integrations requires reviewing
their licenses and updating the dependency configuration.

`patches/query-string@7.1.3.patch` changes the decoder import to consume the ESM
default export of the security-fixed `decode-uri-component`. The upstream
query-string MIT license remains in the dependency notices. The public parser
API is unchanged and its WalletConnect integration is covered by a regression test.

## Names and logos

Subscan, Polkadot, Kusama, Paseo and wallet-provider names and logos identify
their respective products and networks. Their trademark rights remain with
their owners; Apache-2.0 does not grant permission to use those marks to imply
endorsement. Chain artwork under `public/chains` retains its original ownership.
