"use client";

import { useApp } from "@/components/app-state";
import { Button, Field, Input, ModuleHeader, PageHeader, Panel } from "@/components/ui";
import { useState } from "react";

export default function Page() {
  const { account } = useApp();
  const [saved, setSaved] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker="Account" title="Settings" />
      <Panel padding="spacious" className="max-w-xl">
        <ModuleHeader title="Profile preferences" meta="Preview only — nothing is stored" />
        <p className="mb-6 text-sm leading-6 text-mute">{account ? "These preferences are a preview and are not saved to a backend." : "Connect a wallet from the top bar to preview these preferences."}</p>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setSaved(true);
          }}
        >
          <Field label="Email notifications">
            <Input name="email" autoComplete="email" type="email" placeholder="you@example.org" disabled={!account} />
          </Field>
          <Field label="Display name">
            <Input name="display-name" autoComplete="nickname" placeholder="Optional" disabled={!account} />
          </Field>
          <Button type="submit" disabled={!account}>
            {saved ? "Previewed" : "Preview"}
          </Button>
        </form>
        {saved ? <p role="status" className="mt-3 text-sm text-mute">Preview only. These preferences have not been saved.</p> : null}
      </Panel>
    </div>
  );
}
