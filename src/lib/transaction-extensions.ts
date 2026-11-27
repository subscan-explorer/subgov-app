import type { ApiPromise } from "@polkadot/api";

const emptyExtension = { extrinsic: {}, payload: {} };

/**
 * Types for Asset Hub transaction extensions @polkadot/api does not ship. They only matter when an
 * extension is part of the list the runtime decodes for signed (v4) extrinsics.
 */
export const assetHubSignedExtensions = {
  UnitTransactionExtension: emptyExtension,
  AuthorizeCall: emptyExtension,
  PrevalidateAttests: emptyExtension,
  AsPgas: { extrinsic: { asPgas: "Option<IndivPalletPgasExtensionAsPgasInfo>" }, payload: {} },
  AsDotnsGateway: { extrinsic: { asDotnsGateway: "Option<IndivPalletDotnsGatewayExtensionAsDotnsGatewayInfo>" }, payload: {} },
  RestrictOrigins: { extrinsic: { restrictOrigins: "bool" }, payload: {} },
  EthSetOrigin: emptyExtension,
  StorageWeightReclaim: emptyExtension,
};

type CodecLike = { toString: () => string };
type ExtrinsicMetadataLike = {
  transactionExtensions?: { identifier: CodecLike }[];
  transactionExtensionsByVersion?: { entries: () => Iterable<[CodecLike, Iterable<CodecLike>]> };
};

/**
 * Metadata v16 lists every transaction extension once and maps each extension version to the
 * indices it uses. @polkadot/api 16 signs with the whole list, so signed v4 extrinsics carry extra
 * bytes the runtime cannot decode ("Bad input data provided to validate_transaction"). Signed v4
 * extrinsics use extension version 0; returns that ordered list, or null on older metadata.
 */
export function signedTransactionExtensions(extrinsic: ExtrinsicMetadataLike): string[] | null {
  const all = extrinsic.transactionExtensions?.map((item) => item.identifier.toString()) ?? [];
  const byVersion = extrinsic.transactionExtensionsByVersion;
  if (!all.length || !byVersion) return null;
  const versionZero = [...byVersion.entries()].find(([version]) => Number(version.toString()) === 0)?.[1];
  if (!versionZero) return null;
  const ids = [...versionZero].map((index) => all[Number(index.toString())]);
  if (!ids.length || ids.some((id) => id == null)) return null;
  return ids;
}

/** Points the registry at the extensions signed v4 extrinsics use on this runtime. */
export function applySignedTransactionExtensions(api: ApiPromise) {
  const ids = signedTransactionExtensions(api.registry.metadata.extrinsic as unknown as ExtrinsicMetadataLike);
  if (ids && ids.join(",") !== api.registry.signedExtensions.join(",")) {
    api.registry.setSignedExtensions(ids, assetHubSignedExtensions);
  }
  return api;
}
