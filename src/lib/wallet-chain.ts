/** The adapter always sends both namespaces, so scope both to the selected chain. */
export function walletConnectChains(genesisHash: `0x${string}`) {
  const id = `polkadot:${genesisHash.slice(2, 34)}` as const;
  return { chainIds: [id], optionalChainIds: [id] };
}

/** A WalletConnect signer is only usable on the genesis hash approved by its session. */
export function walletCanSignOnChain(source: string | null, approvedGenesisHash: string | null, targetGenesisHash: string): boolean {
  // Watch-only accounts (#115) have no signer.
  if (source === "watch") return false;
  return source !== "wallet-connect" || approvedGenesisHash === targetGenesisHash;
}
