/** Browser wallets SubGov lists (#114, #115). Detection is pure so it can be tested without a browser. */

export type WalletInfo = { id: string; title: string; installed: boolean; connectable: boolean; installUrl: string; note?: string };

export const WATCH_SOURCE = "watch";

const KNOWN: { id: string; title: string; installUrl: string }[] = [
  { id: "talisman", title: "Talisman", installUrl: "https://talisman.xyz/download" },
  { id: "subwallet-js", title: "SubWallet", installUrl: "https://www.subwallet.app/download.html" },
  { id: "polkadot-js", title: "Polkadot.js", installUrl: "https://polkadot.js.org/extension/" },
  { id: "mimir", title: "Mimir", installUrl: "https://app.mimir.global" },
  { id: "enkrypt", title: "Enkrypt", installUrl: "https://www.enkrypt.com" },
  { id: "polkagate", title: "PolkaGate", installUrl: "https://polkagate.xyz" },
  { id: "fearless-wallet", title: "Fearless", installUrl: "https://fearlesswallet.io" },
];
/** Always listed so people can see what to install; the rest only appear when injected. */
const ALWAYS = new Set(["talisman", "subwallet-js", "polkadot-js"]);

export type WalletEnvironment = {
  injected: string[];
  /** Nova's in-app browser injects as `polkadot-js` and sets `walletExtension.isNovaWallet`. */
  nova?: boolean;
  /** Talisman's Ethereum provider exists but the page has no Substrate access. */
  talismanEthOnly?: boolean;
  /** Opened inside Mimir (multisig); it injects `mimir` once SubGov asks. */
  inMimir?: boolean;
};

const titleCase = (id: string) => id.replace(/[-_]js$/, "").split(/[-_]/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");

export function detectWallets(env: WalletEnvironment): WalletInfo[] {
  const injected = new Set(env.injected);
  const known = KNOWN.flatMap((wallet): WalletInfo[] => {
    const connectable = injected.has(wallet.id);
    if (wallet.id === "polkadot-js" && env.nova && connectable) return [{ ...wallet, title: "Nova Wallet", installUrl: "https://novawallet.io", installed: true, connectable: true, note: "In-app browser" }];
    if (wallet.id === "mimir") return connectable || env.inMimir ? [{ ...wallet, installed: true, connectable, note: connectable ? "Multisig" : "Connecting to Mimir…" }] : [];
    if (!connectable && !ALWAYS.has(wallet.id)) return [];
    const installed = connectable || (wallet.id === "talisman" && Boolean(env.talismanEthOnly));
    return [{ ...wallet, installed, connectable }];
  });
  const extra = [...injected].filter((id) => !KNOWN.some((wallet) => wallet.id === id)).sort()
    .map((id) => ({ id, title: titleCase(id), installed: true, connectable: true, installUrl: "" }));
  const all = [...known, ...extra];
  // Installed wallets first, keeping the listed order otherwise.
  return [...all.filter((wallet) => wallet.connectable), ...all.filter((wallet) => !wallet.connectable)];
}

/** Proxy types that may dispatch governance calls on behalf of the real account (#116). */
export const GOVERNANCE_PROXY_TYPES = ["Any", "NonTransfer", "Governance"] as const;

export function proxyAllowsGovernance(proxyType: string) {
  return (GOVERNANCE_PROXY_TYPES as readonly string[]).includes(proxyType);
}

/** Select an immediate governance permission, preferring the broadest one for other governance calls. */
export function governanceProxyType(definitions: { delegate: string; proxyType: string; delay: number | string }[], signer: string, sameAccount: (a: string, b: string) => boolean) {
  return GOVERNANCE_PROXY_TYPES.find((type) => definitions.some((item) =>
    sameAccount(item.delegate, signer) && item.proxyType === type && Number(item.delay) === 0)) ?? null;
}
