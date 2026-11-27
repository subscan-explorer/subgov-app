"use client";

import { ExplorerControls } from "@/components/explorer-controls";
import { Modal } from "@/components/modal";
import { useApp } from "@/components/app-state";
import { useChain, useChainFromUrl, useChainHref } from "@/hooks/use-chain-href";
import { Badge, Button, ChoiceButton, IconButton, MenuItem, Panel, TextButton } from "@/components/ui";
import { CopyButton } from "@/components/copy-button";
import { ProxyPanel, useAccountSummaries, WatchAddressForm } from "@/components/wallet-extras";
import { SearchPalette } from "@/components/search-palette";
import { Popover } from "@base-ui/react/popover";
import { CHAIN_PARAM } from "@/lib/chain-query";
import { nav } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { shortAddr } from "@/lib/format";
import Link from "next/link";
import { LayoutDashboard, Vote, Users, Landmark, Receipt, Gift, GraduationCap, ListChecks, UserRound, Settings, Menu, X, ChevronDown, ScrollText, SquareCheck, Coins, Handshake, Route, Activity, ChartColumn, Fish, FileCode, ShieldCheck, GitBranch, Layers, CalendarDays } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

const navIcons: Record<string, typeof LayoutDashboard> = {
  "/": LayoutDashboard, "/referenda/": Vote, "/delegation/": Users,
  "/treasury/": Landmark, "/treasury/spends/": Receipt, "/treasury/bounties/": Gift,
  "/fellowship/": GraduationCap, "/fellowship/referenda/": ScrollText,
  "/fellowship/tracks/": ListChecks, "/account/": UserRound, "/settings/": Settings,
  "/referenda/tracks/": Route, "/votes/": Activity, "/referenda/statistics/": ChartColumn, "/referenda/whales/": Fish, "/preimages/": FileCode, "/whitelist/": ShieldCheck,
  "/treasury/child-bounties/": GitBranch, "/treasury/multiasset-bounties/": Layers, "/calendar/": CalendarDays,
  "/account/votes/": SquareCheck, "/account/deposits/": Coins, "/delegation/mine/": Handshake,
};

function navMatches(item: { href: string; exact?: boolean }, pathname: string) {
  const normalized = pathname.replace(/\/$/, "") || "/";
  const target = item.href.replace(/\/$/, "") || "/";
  return item.href === "/" || item.exact ? normalized === target : normalized === target || normalized.startsWith(`${target}/`);
}

// Labels that appear in more than one sidebar group ("Overview", "Referenda")
// get their section prefixed for screen readers.
const duplicateNavLabels = new Set(
  nav.flatMap((group) => group.items.map((item) => item.label))
    .filter((label, index, all) => all.indexOf(label) !== index),
);

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const visualChain = useChainFromUrl();
  const chainHref = useChainHref();
  const [open, setOpen] = useState(false);
  const [chainPending, startChainTransition] = useTransition();

  const navigation = <>
        <div className="flex h-[65px] items-center justify-between px-5">
          <Link href={chainHref("/")} onClick={() => setOpen(false)} className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
            <span className="brand-mark" aria-hidden="true" />
            SubGov
          </Link>
          <IconButton type="button" variant="plain" aria-label="Close navigation" className="lg:hidden" onClick={() => setOpen(false)}><X size={20} /></IconButton>
        </div>
        <nav aria-label="Main navigation" className="flex min-h-[calc(100dvh-65px)] flex-col gap-5 px-3 pb-6 pt-3">
          {nav.map((group) => (
            <div key={group.label} role="group" aria-label={group.label} className={group.label === "Personal" ? "mt-auto" : undefined}>
              <div className="shell-group-label" aria-hidden="true">
                {group.label}
              </div>
              <div className="flex flex-col">
                {group.items.map((item) => {
                  const active = navMatches(item, pathname)
                    // A more specific item (e.g. Tracks under Referenda) wins over its parent prefix.
                    && !nav.some((other) => other.items.some((candidate) => candidate.href.length > item.href.length && navMatches(candidate, pathname)));
                  const Icon = navIcons[item.href] ?? LayoutDashboard;
                  return (
                    <Link
                      key={item.href}
                      href={chainHref(item.href)}
                      aria-current={active ? "page" : undefined}
                      aria-label={duplicateNavLabels.has(item.label) ? `${group.label} ${item.label}` : undefined}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "nav-item flex min-h-10 items-center gap-3 rounded-full px-3 py-2 text-sm leading-snug",
                        active ? "nav-item-active" : "text-mute",
                      )}
                    >
                      <Icon size={18} strokeWidth={1.7} aria-hidden="true" /><span className="min-w-0 flex-1">{item.label}</span>
                      {item.tag ? <Badge>{item.tag}</Badge> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
  </>;

  return (
    <div data-chain={visualChain} className="subgov-shell min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside id="primary-navigation" aria-label="Primary navigation" className="shell-side hidden lg:sticky lg:top-0 lg:block lg:h-screen lg:overflow-y-auto">{navigation}</aside>
      {open ? <Modal titleId="navigation-title" onClose={() => setOpen(false)} className="subgov-drawer !m-0 !h-dvh !max-h-dvh !w-[min(320px,90vw)] !max-w-none !rounded-l-none !rounded-r-[28px] !bg-panel">
        <div id="mobile-navigation"><h2 id="navigation-title" className="sr-only">Navigation</h2>{navigation}</div>
      </Modal> : null}
      <div className="flex min-h-screen min-w-0 flex-col">
        <Topbar open={open} onMenu={() => setOpen((v) => !v)} startChainTransition={startChainTransition} />
        <main id="main-content" tabIndex={-1} aria-busy={chainPending || undefined} className={cn(chainPending && "chain-pending", "mx-auto w-full max-w-[1400px] flex-1 px-[15px] py-5 md:px-[30px] md:py-[30px]")}>{children}</main>
        <footer className="shell-footer mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-3 border-t border-line px-[15px] py-5 text-xs text-mute md:px-[30px]">
          <span>© {new Date().getFullYear()} SubGov</span>
          <span>Data provided by <a href="https://www.subscan.io" target="_blank" rel="noreferrer" className="text-link hover:underline">Subscan</a></span>
        </footer>
      </div>
    </div>
  );
}

function Topbar({ onMenu, open, startChainTransition }: { onMenu: () => void; open: boolean; startChainTransition: (action: () => void) => void }) {
  const {
    account, identity, accounts, walletSource, walletConnectGenesisHash, installedWallets, walletDetectionComplete, readOnly, proxyReal, signerAccount,
    connectInjected, connectWalletConnect, selectAccount, disconnect, setChainId,
    walletDialogOpen, walletDialogChain, openWalletDialog, closeWalletDialog,
  } = useApp();
  const chain = useChain();
  const chainId = useChainFromUrl();
  const chainHref = useChainHref();
  const [walletBusy, setWalletBusy] = useState<string | null>(null);
  const summaries = useAccountSummaries(walletDialogChain, walletDialogOpen ? accounts.map((item) => item.address) : []);
  const pairing = walletBusy === "wallet-connect";
  const [walletError, setWalletError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    // Internal links and pasted URLs can change the target chain without using ExplorerControls.
    if (walletSource === "wallet-connect" && walletConnectGenesisHash !== chain.genesisHash) void disconnect();
  }, [disconnect, chain.genesisHash, walletConnectGenesisHash, walletSource]);
  const connectWallet = async (id: string, connect: () => Promise<void>) => {
    setWalletError(null);
    setWalletBusy(id);
    try {
      await connect();
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Wallet connection failed");
    } finally {
      setWalletBusy(null);
    }
  };

  return (
    <header aria-label="Site header" className="topbar shell-topbar sticky top-0 z-20">
      <div className="mx-auto flex max-w-[1400px] min-h-16 flex-nowrap items-center gap-2 overflow-hidden px-[15px] py-2 md:gap-3 md:px-[30px]">
        <IconButton type="button" variant="plain" aria-label="Toggle navigation" aria-expanded={open} className="shell-circle lg:hidden" onClick={onMenu}>
          <Menu size={19} />
        </IconButton>
        <Breadcrumb chainName={chain.name} pathname={pathname} />
        <SearchPalette />
        <ExplorerControls chainId={chainId} onChainChange={(id) => {
          setChainId(id);
          const params = new URLSearchParams(searchParams.toString());
          params.set(CHAIN_PARAM, id);
          startChainTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
        }} />
        {account ? (
          <AccountMenu
            account={account}
            identity={identity}
            walletSource={readOnly ? "watch-only (read-only)" : proxyReal && signerAccount ? `proxy ${shortAddr(signerAccount)} · ${walletSource}` : walletSource}
            accountHref={chainHref("/account/")}
            onSwitch={() => openWalletDialog(chain)}
            onDisconnect={() => void disconnect()}
          />
        ) : (
          <Button variant="brass" size="lg" disabled={pairing} aria-busy={pairing} onClick={() => openWalletDialog(chain)}>
            {pairing ? "Opening WalletConnect…" : (
              <>
                <span className="sm:hidden">Connect</span>
                <span className="hidden sm:inline">Connect wallet</span>
              </>
            )}
          </Button>
        )}
      </div>
      {/* Release the native dialog's top layer while WalletConnect presents its QR overlay. */}
      {walletDialogOpen && !pairing ? <Modal titleId="wallet-title" onClose={closeWalletDialog} className="max-w-md">
          <Panel padding="content" className="bg-panel">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="wallet-title" className="font-display text-base">Choose a wallet</h2>
              <TextButton tone="neutral" type="button" className="-mr-2" onClick={closeWalletDialog}>
                Close
              </TextButton>
            </div>
            <p className="mb-4 text-sm text-mute">
              Connect an account to sign governance actions on {walletDialogChain.name}. SubGov never receives your private key.
            </p>
            <div className="flex flex-col gap-2">
              {installedWallets.map((wallet) => wallet.connectable ? (
                <Button
                  key={wallet.id}
                  type="button"
                  variant="line"
                  className="wallet-row"
                  disabled={walletBusy != null}
                  onClick={() => void connectWallet(wallet.id, () => connectInjected(wallet.id))}
                >
                  <span>{wallet.title}</span>
                  <span className="text-xs text-mute">{walletBusy === wallet.id ? "Waiting…" : wallet.note ?? "Browser extension"}</span>
                </Button>
              ) : wallet.installed ? (
                <div key={wallet.id} className="wallet-row">
                  <span>{wallet.title}</span>
                  <span className="text-xs text-mute">{wallet.note ?? "Substrate access unavailable"}</span>
                </div>
              ) : !walletDetectionComplete ? (
                <div key={wallet.id} className="wallet-row">
                  <span>{wallet.title}</span>
                  <span className="text-xs text-mute">Detecting…</span>
                </div>
              ) : wallet.id === "talisman" ? (
                <div key={wallet.id} className="wallet-row">
                  <span>{wallet.title}</span>
                  <span className="text-xs text-mute">Unavailable on this site</span>
                </div>
              ) : (
                <a
                  key={wallet.id}
                  href={wallet.installUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="wallet-row"
                >
                  <span>{wallet.title}</span>
                  <span className="text-xs text-mute">Install ↗</span>
                </a>
              ))}
              <Button
                type="button"
                variant="line"
                className="wallet-row"
                disabled={walletBusy != null}
                onClick={() => void connectWallet("wallet-connect", () => connectWalletConnect(walletDialogChain))}
              >
                <span>WalletConnect</span>
                <span className="text-xs text-mute">Mobile or QR</span>
              </Button>
            </div>
            {walletError ? <p className="mt-3 text-sm text-nay" role="alert">{walletError}. Check the wallet, then try again.</p> : null}
            {accounts.length ? (
              <div className="mt-5 border-t border-line pt-4">
                <p className="mb-2 text-xs font-medium text-mute">Account</p>
                <div className="flex flex-col gap-2">
                  {accounts.map((item) => (
                    <ChoiceButton
                      key={item.address}
                      type="button"
                      variant="card"
                      selected={(signerAccount ?? account) === item.address}
                      onClick={() => selectAccount(item.address)}
                      className="min-w-0 items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0 text-left">
                        <span className="block truncate">{summaries.identity(item.address) ?? item.name ?? "Unnamed account"}</span>
                        {summaries.identity(item.address) && item.name ? <span className="block truncate text-xs text-mute">{item.name}</span> : null}
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="num block text-xs text-mute">{shortAddr(item.address)}</span>
                        {summaries.balance(item.address) ? <span className="num block text-xs text-mute">{summaries.balance(item.address)}</span> : null}
                      </span>
                    </ChoiceButton>
                  ))}
                </div>
                {!readOnly ? <div className="mt-4"><ProxyPanel chain={walletDialogChain} /></div> : null}
                <Button type="button" className="mt-3 w-full" onClick={closeWalletDialog}>
                  Continue with {readOnly ? "watch-only address" : walletSource === "wallet-connect" ? "WalletConnect" : proxyReal ? "proxy" : "selected account"}
                </Button>
              </div>
            ) : null}
            <div className="mt-5 border-t border-line pt-4"><WatchAddressForm onDone={closeWalletDialog} /></div>
          </Panel>
      </Modal> : null}
    </header>
  );
}

/** Connected account chip: shows who is signing; Disconnect sits one level down. */
function AccountMenu({ account, identity, walletSource, accountHref, onSwitch, onDisconnect }: {
  account: string;
  identity: string | null;
  walletSource: string | null;
  accountHref: string;
  onSwitch: () => void;
  onDisconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="account-chip" aria-label={`Account ${identity ?? shortAddr(account)}`}>
        <span className="account-chip-dot" aria-hidden="true" />
        <span className="max-w-[9rem] truncate">{identity ?? shortAddr(account)}</span>
        <ChevronDown size={14} aria-hidden="true" className="text-mute" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup className="explorer-popover w-[min(20rem,calc(100vw-24px))]" aria-label="Account">
            <div className="px-2.5 pb-2 pt-1.5">
              <div className="text-sm font-semibold text-paper">{identity ?? "Connected account"}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="num min-w-0 truncate text-xs text-mute" title={account}>{shortAddr(account, 8)}</span>
                <CopyButton value={account} />
              </div>
              {walletSource ? <div className="mt-1 text-xs text-mute">via {walletSource}</div> : null}
            </div>
            <div className="border-t border-line pt-1.5">
              <Link href={accountHref} className="subscan-menu-item" onClick={() => setOpen(false)}>Account overview</Link>
              <MenuItem onClick={() => { setOpen(false); onSwitch(); }}>Switch account</MenuItem>
              <MenuItem className="text-nay" onClick={() => { setOpen(false); onDisconnect(); }}>Disconnect</MenuItem>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** "Polkadot / Treasury / Spends" — derived from the navigation so it never drifts from the sidebar. */
function Breadcrumb({ chainName, pathname }: { chainName: string; pathname: string }) {
  const normalized = pathname.replace(/\/$/, "") || "/";
  let match: { group: string; label: string; length: number } | null = null;
  for (const group of nav) {
    for (const item of group.items) {
      const target = item.href.replace(/\/$/, "") || "/";
      const hit = target === "/" ? normalized === "/" : normalized === target || normalized.startsWith(`${target}/`);
      if (hit && (!match || target.length > match.length)) match = { group: group.label, label: item.label, length: target.length };
    }
  }
  const trail = [chainName, ...(match ? (match.group === "Workspace" ? [match.label] : [match.group, match.label]) : [])];
  return (
    <nav aria-label="Breadcrumb" className="shell-crumb min-w-0 flex-1 truncate">
      {trail.map((part, i) => (
        <span key={`${part}-${i}`} className={i === trail.length - 1 ? "text-paper" : undefined}>
          {i ? <span className="shell-crumb-sep" aria-hidden="true">/</span> : null}
          {part}
        </span>
      ))}
    </nav>
  );
}

export function useActivePath() {
  const pathname = usePathname();
  return useMemo(() => pathname, [pathname]);
}
