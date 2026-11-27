"use client";

import { Popover } from "@base-ui/react/popover";
import { Check, ChevronDown, Moon, Sun } from "lucide-react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { IconButton, MenuItem } from "@/components/ui";
import { chains } from "@/lib/chains";
import type { ChainId } from "@/lib/types";

/** Source: Subscan CurrentChain and Footer/ThemeSwitcher. */
export function ExplorerControls({ chainId, onChainChange }: { chainId: ChainId; onChainChange: (id: ChainId) => void }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [networkOpen, setNetworkOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  useEffect(() => setMounted(true), []);
  const chain = chains.find((item) => item.id === chainId) ?? chains[0];
  const ThemeIcon = !mounted || theme !== "dark" ? Sun : Moon;
  return <div className="ml-auto flex shrink-0 items-center gap-3">
    <Popover.Root open={networkOpen} onOpenChange={setNetworkOpen}>
      <Popover.Trigger aria-label={`Switch network, ${chain.name}`} className="explorer-chain-trigger">
        <Image src={`/chains/${chainId}/logo-mini.png`} width={22} height={22} alt="" loading="eager" fetchPriority="high" className="explorer-chain-mini" />
        <span className="explorer-chain-name">{chain.name}</span>
        <span className="explorer-chain-symbol">{chain.symbol}</span>
        <ChevronDown size={14} strokeWidth={2} aria-hidden="true" className="explorer-chain-chevron" />
      </Popover.Trigger>
      <Popover.Portal><Popover.Positioner sideOffset={8} align="end" className="z-50"><Popover.Popup className="explorer-popover min-w-56" aria-label="Networks">
        {chains.map((item) => <MenuItem key={item.id} selected={chainId === item.id} onClick={() => { setNetworkOpen(false); if (item.id !== chainId) onChainChange(item.id); }}>
          <Image src={`/chains/${item.id}/logo-mini.png`} width={24} height={24} alt="" className="rounded-full" /><span className="flex-1">{item.name}</span>{chainId === item.id ? <Check size={16} /> : null}
        </MenuItem>)}
      </Popover.Popup></Popover.Positioner></Popover.Portal>
    </Popover.Root>
    <Popover.Root open={themeOpen} onOpenChange={setThemeOpen}>
      <Popover.Trigger render={<IconButton aria-label="Choose theme" variant="plain" className="shell-circle" />}><ThemeIcon size={20} /></Popover.Trigger>
      <Popover.Portal><Popover.Positioner sideOffset={8} align="end" className="z-50"><Popover.Popup className="explorer-popover min-w-36" aria-label="Theme">
        {([['light', 'Light', Sun], ['dark', 'Dark', Moon]] as const).map(([value, label, Icon]) => <MenuItem key={value} selected={mounted && theme === value} onClick={() => { setTheme(value); setThemeOpen(false); }}><Icon size={16} /><span className="flex-1">{label}</span>{mounted && theme === value ? <Check size={14} /> : null}</MenuItem>)}
      </Popover.Popup></Popover.Positioner></Popover.Portal>
    </Popover.Root>
  </div>;
}
