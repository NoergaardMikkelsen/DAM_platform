import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"

export default function Loading() {
  return (
    <div className="p-8">
      <ListPageHeaderSkeleton showCreateButton={true} />
      <SearchSkeleton />
      <TabsSkeleton count={3} />
      <TableSkeleton rows={8} columns={4} />
    </div>
  )
}
