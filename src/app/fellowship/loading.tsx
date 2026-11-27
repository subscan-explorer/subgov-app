import { ListPageSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return <ListPageSkeleton title="Fellowship" description="Technical Fellowship membership and origin activity indexed by Subscan." stats={4} rows={4} />;
}
