import { DataNotice } from "@/components/data-notice";
import { PageHeader } from "@/components/ui";

/** A request failed (not a missing record): keep the way back and say what happened. */
export function RecordUnavailable({ title, back }: { title: string; back: { href: string; label: string } }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader back={back} title={title} />
      <DataNotice kind="error" title="Data unavailable">
        Subscan did not return this record right now. It may still exist — reload the page in a moment, or open it from the list.
      </DataNotice>
    </div>
  );
}
