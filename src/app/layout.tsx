import { AppStateProvider } from "@/components/app-state";
import { Shell } from "@/components/shell";
import { ThemeProvider } from "@/components/theme-provider";
import { chainCookie } from "@/lib/chains";
import type { ChainId } from "@/lib/types";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Suspense } from "react";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "SubGov",
    template: "%s · SubGov",
  },
  description: "Multi-chain governance ledger for Substrate networks.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const savedChain = (await cookies()).get(chainCookie)?.value;
  const initialChainId: ChainId = savedChain === "kusama" || savedChain === "paseo" ? savedChain : "polkadot";

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AppStateProvider initialChainId={initialChainId}>
            <Suspense fallback={<div className="min-h-screen bg-ink" />}>
              <Shell>{children}</Shell>
            </Suspense>
          </AppStateProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
