import type { Metadata } from "next";
import { NotFoundActions } from "@/components/not-found-actions";
import { PageHeader, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader kicker="404" title="This page doesn’t exist" />
      <Panel padding="spacious" className="flex flex-col items-start gap-4">
        <p className="max-w-xl text-sm leading-6 text-mute">
          The address may be mistyped, or the record has not been indexed for the selected network yet.
        </p>
        <NotFoundActions />
      </Panel>
    </div>
  );
}
