"use client";

import { chainCookie, chains, governanceChains, type ChainConfig } from "@/lib/chains";
import { walletConnectChains } from "@/lib/wallet-chain";
import type { ChainId } from "@/lib/types";
import { detectWallets, WATCH_SOURCE, type WalletInfo } from "@/lib/wallets";
import type { BaseWallet } from "@polkadot-onboard/core";
import type { Signer } from "@polkadot/api/types";
import { decodeAddress } from "@polkadot/util-crypto";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type ConnectedAccount = { address: string; name?: string; source: string; type?: "ed25519" | "sr25519" | "ecdsa" };
type InstalledWallet = WalletInfo;
type InjectedExtension = { accounts: { get: (anyType?: boolean) => Promise<{ address: string; name?: string; type?: string }[]> }; signer: Signer };
type InjectedWindow = Window & {
  injectedWeb3?: Record<string, { enable?: (origin: string) => Promise<InjectedExtension> }>;
  walletExtension?: { isNovaWallet?: boolean };
  talismanEth?: { isTalisman?: boolean };
};

function walletEnvironment(inMimir: boolean) {
  const w = window as InjectedWindow;
  const injected = Object.keys(w.injectedWeb3 ?? {});
  return detectWallets({ injected, nova: Boolean(w.walletExtension?.isNovaWallet), talismanEthOnly: Boolean(w.talismanEth?.isTalisman) && !injected.includes("talisman"), inMimir });
}

function connectedAccount(item: { address: string; name?: string }, source: string): ConnectedAccount | null {
  const type = (item as typeof item & { type?: unknown }).type;
  if (type != null && type !== "sr25519" && type !== "ed25519" && type !== "ecdsa") return null;
  try {
    if (decodeAddress(item.address).length !== 32) return null;
  } catch {
    return null;
  }
  return { address: item.address, name: item.name, type: type as ConnectedAccount["type"], source };
}

type AppState = {
  chainId: ChainId;
  setChainId: (id: ChainId) => void;
  account: string | null;
  accountType: ConnectedAccount["type"];
  identity: string | null;
  walletSource: string | null;
  walletConnectGenesisHash: string | null;
  signer: Signer | null;
  accounts: ConnectedAccount[];
  installedWallets: InstalledWallet[];
  walletDetectionComplete: boolean;
  refreshInstalledWallets: () => void;
  connectInjected: (source: string) => Promise<void>;
  connectWalletConnect: (chain: ChainConfig) => Promise<void>;
  /** Watch-only: browse as an address without a signer (#115). */
  connectWatch: (address: string) => void;
  readOnly: boolean;
  /** Sign governance calls through `proxy.proxy` on behalf of this real account (#116). `account` is then the real account. */
  proxyReal: string | null;
  setProxyReal: (address: string | null) => void;
  /** The wallet account that signs: differs from `account` only while acting as a proxy. */
  signerAccount: string | null;
  proxySigner: string | null;
  selectAccount: (address: string) => void;
  disconnect: () => Promise<void>;
  /** One wallet picker for the whole app (topbar, Vote, Delegate, Account). */
  walletDialogOpen: boolean;
  walletDialogChain: ChainConfig;
  openWalletDialog: (chain?: ChainConfig) => void;
  closeWalletDialog: () => void;
};

const Ctx = createContext<AppState | null>(null);
const DAPP_NAME = "SubGov";
const WALLET_STORAGE_KEY = "subgov-wallet";

export function AppStateProvider({ children, initialChainId = "polkadot" }: { children: React.ReactNode; initialChainId?: ChainId }) {
  const [chainId, setChainIdState] = useState<ChainId>(initialChainId);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [walletSource, setWalletSource] = useState<string | null>(null);
  const [walletConnectGenesisHash, setWalletConnectGenesisHash] = useState<string | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);
  const [installedWallets, setInstalledWallets] = useState<InstalledWallet[]>(() => detectWallets({ injected: [] }));
  const [inMimir, setInMimir] = useState(false);
  const [proxySelection, setProxySelection] = useState<{ key: string; address: string } | null>(null);
  const [walletDetectionComplete, setWalletDetectionComplete] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [walletDialogChain, setWalletDialogChain] = useState<ChainConfig>(() => chains.find((item) => item.id === initialChainId) ?? chains[0]);
  const walletConnect = useRef<BaseWallet | null>(null);
  const restoreStarted = useRef(false);
  const walletOperation = useRef(0);

  const clearWallet = (operation?: number) => {
    if (operation != null && operation !== walletOperation.current) return;
    walletOperation.current += 1;
    localStorage.removeItem(WALLET_STORAGE_KEY);
    walletConnect.current = null;
    setAccounts([]);
    setSelected(null);
    setWalletSource(null);
    setWalletConnectGenesisHash(null);
    setSigner(null);
  };

  const refreshInstalledWallets = useCallback(() => {
    setInstalledWallets(walletEnvironment(inMimir));
  }, [inMimir]);

  useEffect(() => {
    // Mimir (multisig) opens SubGov in an iframe and injects itself once asked.
    if (window.parent === window) return;
    let cancelled = false;
    import("@mimirdev/apps-inject").then(async ({ inject, isMimirReady, MIMIR_REGEXP }) => {
      const origin = await isMimirReady();
      if (cancelled || !origin || !MIMIR_REGEXP.test(origin)) return;
      inject();
      setInMimir(true);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    refreshInstalledWallets();
    const checks = [100, 500, 1_500].map((delay, index) => window.setTimeout(() => {
      refreshInstalledWallets();
      if (index === 2) setWalletDetectionComplete(true);
    }, delay));
    const refresh = () => refreshInstalledWallets();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      checks.forEach(window.clearTimeout);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refreshInstalledWallets]);

  const setChainId = (id: ChainId) => {
    if (id !== chainId) {
      // Invalidate an in-flight connection and remove its signer before navigation.
      const previousWallet = walletConnect.current;
      if (previousWallet || walletSource === "wallet-connect") {
        clearWallet();
        if (previousWallet) void previousWallet.disconnect().catch(() => {});
      } else {
        walletOperation.current += 1;
      }
    }
    document.cookie = `${chainCookie}=${id};path=/;max-age=31536000;SameSite=Lax`;
    setChainIdState(id);
  };

  const applyAccounts = (items: ConnectedAccount[], source: string, nextSigner: Signer, preferredAddress: string | undefined, operation: number, genesisHash?: string) => {
    if (!items.length) throw new Error("The wallet returned no accounts");
    if (operation !== walletOperation.current) return;
    const address = items.some((item) => item.address === preferredAddress) ? preferredAddress! : items[0].address;
    setAccounts(items);
    setSelected(address);
    setWalletSource(source);
    setWalletConnectGenesisHash(genesisHash ?? null);
    setSigner(nextSigner);
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ source, address, ...(genesisHash ? { genesisHash } : {}) }));
  };

  const connectInjected = async (source: string, preferredAddress?: string, restoreOperation?: number) => {
    if (walletConnect.current) {
      const previousWallet = walletConnect.current;
      clearWallet();
      void previousWallet.disconnect().catch(() => {});
    }
    const operation = restoreOperation ?? ++walletOperation.current;
    const injected = () => (window as InjectedWindow).injectedWeb3?.[source];
    const title = installedWallets.find((item) => item.id === source)?.title ?? source;
    for (let attempt = 0; !injected()?.enable && attempt < 10; attempt++) await new Promise((resolve) => setTimeout(resolve, 100));
    const provider = injected();
    if (!provider?.enable) throw new Error(`${title} is not exposed to this page. Allow the extension access to ${window.location.host}, then reload`);
    const extension = await provider.enable(DAPP_NAME);
    const items = await extension.accounts.get(true);
    applyAccounts(items.map((item) => connectedAccount(item, source)).filter((item): item is ConnectedAccount => item != null), source, extension.signer, preferredAddress, operation);
  };

  const connectWalletConnect = async (chain: ChainConfig, preferredAddress?: string, restoreOperation?: number) => {
    if (walletConnect.current) {
      const previousWallet = walletConnect.current;
      clearWallet();
      void previousWallet.disconnect().catch(() => {});
    }
    const operation = restoreOperation ?? ++walletOperation.current;
    const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
    if (!projectId) throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is not configured");
    const requestedChains = walletConnectChains(chain.genesisHash);
    const [expectedChain] = requestedChains.chainIds;
    const { WalletConnectProvider } = await import("@polkadot-onboard/wallet-connect");
    if (operation !== walletOperation.current) return;
    let wallet: BaseWallet;
    [wallet] = await new WalletConnectProvider({
      projectId,
      relayUrl: "wss://relay.walletconnect.com",
      ...requestedChains,
      onSessionDelete: () => {
        if (walletConnect.current === wallet) clearWallet(operation);
      },
      metadata: { name: DAPP_NAME, description: "Polkadot governance", url: window.location.origin, icons: [`${window.location.origin}/icon.svg`] },
    }, DAPP_NAME).getWallets();
    if (operation !== walletOperation.current) return;
    let preserveSession = false;
    try {
      await wallet.connect();
      if (operation !== walletOperation.current) {
        await wallet.disconnect();
        return;
      }
      const approvedForChain = () => {
        const session = (wallet as BaseWallet & { session?: { namespaces?: Record<string, { chains?: string[]; accounts?: string[] }> } }).session;
        const namespace = session?.namespaces?.polkadot;
        return namespace?.chains?.includes(expectedChain)
          || namespace?.accounts?.some((item) => item.startsWith(`${expectedChain}:`));
      };
      const approved = approvedForChain();
      if (!approved && restoreOperation == null) {
        await wallet.disconnect();
        throw new Error(`The previous WalletConnect session was disconnected. Select WalletConnect again to connect ${chain.name}`);
      }
      preserveSession = !approved && restoreOperation != null;
      if (!approved) throw new Error(`WalletConnect is not connected to ${chain.name}`);
      const items = await wallet.getAccounts();
      if (!wallet.signer) throw new Error("WalletConnect did not provide a signer");
      if (operation !== walletOperation.current) {
        await wallet.disconnect();
        return;
      }
      walletConnect.current = wallet;
      applyAccounts(items.map(({ address, name, type }) => ({ address, name, type, source: "wallet-connect" })), "wallet-connect", wallet.signer, preferredAddress, operation, chain.genesisHash);
    } catch (error) {
      if (!preserveSession && operation === walletOperation.current) await wallet.disconnect();
      clearWallet(operation);
      throw error;
    }
  };

  const connectWatchInternal = (address: string) => {
    const item = connectedAccount({ address, name: "Watch-only" }, WATCH_SOURCE);
    if (!item) throw new Error("Enter a valid Substrate address");
    walletOperation.current += 1;
    walletConnect.current = null;
    setAccounts([item]);
    setSelected(address);
    setWalletSource(WATCH_SOURCE);
    setWalletConnectGenesisHash(null);
    setSigner(null);
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ source: WATCH_SOURCE, address }));
  };

  useEffect(() => {
    if (restoreStarted.current) return;
    restoreStarted.current = true;
    try {
      const saved = JSON.parse(localStorage.getItem(WALLET_STORAGE_KEY) ?? "null") as { source?: unknown; address?: unknown; genesisHash?: unknown } | null;
      if (typeof saved?.source !== "string" || typeof saved.address !== "string") return;
      const operation = ++walletOperation.current;
      const savedChain = governanceChains[chainId];
      if (saved.source === "wallet-connect" && saved.genesisHash !== savedChain.genesisHash) {
        clearWallet(operation);
        return;
      }
      if (saved.source === WATCH_SOURCE) {
        connectWatchInternal(saved.address);
        return;
      }
      const restore = saved.source === "wallet-connect"
        ? connectWalletConnect(savedChain, saved.address, operation)
        : connectInjected(saved.source, saved.address, operation);
      void restore.catch(() => clearWallet(operation));
    } catch {
      localStorage.removeItem(WALLET_STORAGE_KEY);
    }
    // Restore only once from the initial cookie; operation IDs invalidate it on a later chain switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectWatch = (address: string) => {
    const previousWallet = walletConnect.current;
    if (previousWallet) void previousWallet.disconnect().catch(() => {});
    connectWatchInternal(address.trim());
  };

  const account = accounts.find((item) => item.address === selected) ?? null;
  const proxyKey = account ? `subgov-proxy:${chainId}:${account.address}` : null;
  useEffect(() => {
    try {
      const address = proxyKey ? localStorage.getItem(proxyKey) : null;
      setProxySelection(proxyKey && address ? { key: proxyKey, address } : null);
    } catch {
      setProxySelection(null);
    }
  }, [proxyKey]);
  const setProxyReal = (address: string | null) => {
    if (!proxyKey) return;
    setProxySelection(address ? { key: proxyKey, address } : null);
    if (address) localStorage.setItem(proxyKey, address);
    else localStorage.removeItem(proxyKey);
  };

  const disconnect = async () => {
    const previousWallet = walletConnect.current;
    clearWallet();
    await previousWallet?.disconnect().catch(() => {});
  };

  const selectAccount = (address: string) => {
    const next = accounts.find((item) => item.address === address);
    if (!next || !walletSource) return;
    setSelected(address);
    localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify({
      source: walletSource,
      address,
      ...(walletSource === "wallet-connect" ? { genesisHash: walletConnectGenesisHash } : {}),
    }));
  };

  const readOnly = walletSource === WATCH_SOURCE;
  const activeProxy = !readOnly && proxySelection?.key === proxyKey ? proxySelection.address : null;
  const value: AppState = {
    chainId, setChainId, account: activeProxy ?? account?.address ?? null, accountType: account?.type, identity: activeProxy ? null : account?.name ?? null, walletSource, walletConnectGenesisHash, signer, accounts,
    installedWallets, walletDetectionComplete, refreshInstalledWallets, connectInjected, connectWalletConnect, selectAccount, disconnect,
    connectWatch, readOnly, proxyReal: activeProxy, setProxyReal,
    signerAccount: account?.address ?? null, proxySigner: activeProxy && account ? account.address : null,
    walletDialogOpen, walletDialogChain,
    openWalletDialog: (target) => {
      setWalletDialogChain(target ?? chains.find((item) => item.id === chainId) ?? chains[0]);
      refreshInstalledWallets();
      setWalletDialogOpen(true);
    },
    closeWalletDialog: () => setWalletDialogOpen(false),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp outside provider");
  return ctx;
}
