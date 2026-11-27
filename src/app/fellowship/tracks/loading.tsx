import { ListPageSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return <ListPageSkeleton title="Fellowship tracks" description="Decision capacity, deposits, and voting periods for each Technical Fellowship origin." back rows={3} />;
}
