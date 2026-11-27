import type { ChainId } from "@/lib/types";

export type ChainConfig = { id: ChainId; name: string; symbol: string; decimals: number; rpc: string; genesisHash: `0x${string}`; subscanUrl: string; testnet?: boolean };

export const governanceChains: Record<ChainId, ChainConfig> = {
  polkadot: { id: "polkadot", name: "Polkadot Asset Hub", symbol: "DOT", decimals: 10, rpc: "wss://polkadot-asset-hub-rpc.polkadot.io", genesisHash: "0x68d56f15f85d3136970ec16946040bc1752654e906147f7e43e9d539d7c3de2f", subscanUrl: "https://assethub-polkadot.subscan.io" },
  kusama: { id: "kusama", name: "Kusama Asset Hub", symbol: "KSM", decimals: 12, rpc: "wss://kusama-asset-hub-rpc.polkadot.io", genesisHash: "0x48239ef607d7928874027a43a67689209727dfb3d3dc5e5b03a39bdc2eda771a", subscanUrl: "https://assethub-kusama.subscan.io" },
  paseo: { id: "paseo", name: "Paseo Asset Hub", symbol: "PAS", decimals: 10, rpc: "wss://asset-hub-paseo-rpc.n.dwellir.com", genesisHash: "0xd6eec26135305a8ad257a20d003357284c8aa03d0bdb2b357ab0a22371e11ef2", subscanUrl: "https://assethub-paseo.subscan.io", testnet: true },
};

export const chains = Object.values(governanceChains);

/** Migrated referendum records retain the originating block numbers on both sides of the move. */
export function referendumBlockExplorer(chain: ChainConfig, at: string) {
  // Start times of relay blocks Polkadot #28490502 and Kusama #30423691.
  const cutover = { polkadot: 1762239654, kusama: 1759844124, paseo: 0 }[chain.id];
  const timestamp = Date.parse(at) / 1000;
  return timestamp > 0 && timestamp < cutover ? `https://${chain.id}.subscan.io` : chain.subscanUrl;
}

export const chainCookie = "subgov-chain";
