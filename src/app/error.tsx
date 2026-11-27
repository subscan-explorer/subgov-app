"use client";

import { useEffect } from "react";
import { Button, ButtonLink, PageHeader, Panel } from "@/components/ui";
import { useChainHref } from "@/hooks/use-chain-href";

/** Route-level error boundary: keeps the shell, explains, and offers a retry. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const chainHref = useChainHref();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker="Error" title="Something went wrong" />
      <Panel padding="spacious" className="flex flex-col items-start gap-4" role="alert">
        <p className="max-w-xl text-sm leading-6 text-mute">
          This page could not be rendered. Subscan may be temporarily unavailable — try again, or head back to the overview.
        </p>
        {error.digest ? <p className="num text-xs text-mute">Reference {error.digest}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>Try again</Button>
          <ButtonLink href={chainHref("/")} variant="line">Back to overview</ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
