import { ListPageSkeleton } from "@/components/loading-skeleton";

export default function Loading() {
  return <ListPageSkeleton title="Treasury" description="Live on-chain treasury spends and bounties from Subscan." stats={3} rows={5} />;
}
