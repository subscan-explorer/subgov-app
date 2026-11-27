import { ListPageSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return <ListPageSkeleton title="Delegation" description="Browse every indexed OpenGov delegate, inspect their account activity, and delegate voting power to a specific track." rows={6} />;
}
