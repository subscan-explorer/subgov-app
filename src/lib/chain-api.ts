import type { ApiPromise } from "@polkadot/api";
import { applySignedTransactionExtensions, assetHubSignedExtensions } from "./transaction-extensions";

/**
 * One live ApiPromise per chain for the whole tab. Creating an ApiPromise downloads and decodes the
 * runtime metadata (~0.7 MB on Asset Hub, 10+ s on slow links), so dialogs reuse this connection and
 * the metadata is kept in IndexedDB keyed by genesis hash and spec version for the next visit.
 */
const connections = new Map<string, Promise<ApiPromise>>();

const DB_NAME = "subgov-chain-metadata";
const STORE = "metadata";

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function cachedMetadata(genesisHash: string): Promise<Record<string, `0x${string}`>> {
  const db = await openDb();
  if (!db) return {};
  return new Promise((resolve) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(genesisHash.toLowerCase());
    request.onsuccess = () => {
      const value = request.result as { key?: string; hex?: `0x${string}` } | undefined;
      resolve(value?.key && value.hex ? { [value.key]: value.hex } : {});
    };
    request.onerror = () => resolve({});
  }).finally(() => db.close()) as Promise<Record<string, `0x${string}`>>;
}

async function storeMetadata(api: ApiPromise) {
  const db = await openDb();
  if (!db) return;
  const genesis = api.genesisHash.toHex().toLowerCase();
  const key = `${api.genesisHash.toHex()}-${api.runtimeVersion.specVersion.toString()}`;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ key, hex: api.runtimeMetadata.toHex() }, genesis);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
  db.close();
}

async function createApi(rpc: string, genesisHash: `0x${string}`) {
  const [{ ApiPromise, WsProvider }, metadata] = await Promise.all([import("@polkadot/api"), cachedMetadata(genesisHash).catch(() => ({}))]);
  const provider = new WsProvider(rpc);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const api = await Promise.race([
    ApiPromise.create({ provider, signedExtensions: assetHubSignedExtensions, metadata }),
    new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error("Network connection timed out. Try again.")), 45_000);
    }),
  ]).catch(async (error) => {
    await provider.disconnect().catch(() => {});
    throw error;
  }).finally(() => clearTimeout(timeout));
  if (api.genesisHash.toHex().toLowerCase() !== genesisHash.toLowerCase()) {
    await api.disconnect().catch(() => {});
    throw new Error("RPC network does not match the selected chain. Transaction cancelled.");
  }
  const key = `${api.genesisHash.toHex()}-${api.runtimeVersion.specVersion.toString()}`;
  if (!(key in metadata)) void storeMetadata(api).catch(() => {});
  return api;
}

/** Shared connection for a governance chain; reconnects if the previous one failed. */
export async function getChainApi(rpc: string, genesisHash: `0x${string}`): Promise<ApiPromise> {
  const id = `${genesisHash.toLowerCase()}|${rpc}`;
  let pending = connections.get(id);
  if (!pending) {
    pending = createApi(rpc, genesisHash);
    connections.set(id, pending);
    pending.catch(() => connections.delete(id));
  }
  const api = await pending;
  await api.isReady;
  // Runtime upgrades swap the metadata in place; re-derive the signed extension list each time.
  return applySignedTransactionExtensions(api);
}

/** Starts connecting in the background, e.g. when a signing dialog opens. */
export function preconnectChainApi(rpc: string, genesisHash: `0x${string}`) {
  void getChainApi(rpc, genesisHash).catch(() => {});
}

/** Close every cached connection (scripts and tests; the app keeps them open). */
export async function disconnectChainApis() {
  const pending = [...connections.values()];
  connections.clear();
  await Promise.allSettled(pending.map(async (connection) => (await connection).disconnect()));
}
