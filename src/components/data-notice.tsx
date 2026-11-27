import { CircleAlert, Inbox, Info } from "lucide-react";
import { Panel } from "@/components/ui";

type DataNoticeKind = "coming-soon" | "empty" | "error" | "info";

const defaultTitle: Record<Exclude<DataNoticeKind, "info">, string> = {
  "coming-soon": "Coming soon",
  empty: "No records found",
  error: "Data unavailable",
};

export function DataNotice({ kind = "coming-soon", title, children }: { kind?: DataNoticeKind; title?: string; children?: React.ReactNode }) {
  if (kind === "info") {
    return (
      <Panel padding="spacious" className="text-sm leading-6 text-mute">
        {title ? <p className="mb-2 font-medium text-paper">{title}</p> : null}
        <p>{children}</p>
      </Panel>
    );
  }
  const heading = title ?? defaultTitle[kind];
  const Icon = kind === "error" ? CircleAlert : kind === "empty" ? Inbox : Info;
  return (
    <Panel role={kind === "error" ? "alert" : "status"} padding="spacious" className="py-12 text-center">
      <Icon size={28} strokeWidth={1.5} aria-hidden="true" className={`mx-auto mb-4 ${kind === "error" ? "text-nay" : "text-mute"}`} />
      <h2 className="font-display text-lg">{heading}</h2>
      <p className="mx-auto mt-2 max-w-xl break-words text-sm leading-6 text-mute">
        {children ?? "This data source is not available through the connected Subscan provider yet."}
      </p>
    </Panel>
  );
}
