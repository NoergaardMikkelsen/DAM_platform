import { ListPageHeaderSkeleton, SearchSkeleton, TabsSkeleton, TableSkeleton } from "@/components/skeleton-loaders"

export default function Loading() {
  return (
    <div className="p-8">
      <ListPageHeaderSkeleton showCreateButton={true} />
      <SearchSkeleton />
      <TabsSkeleton count={6} />
      <TableSkeleton rows={10} columns={5} />
    </div>
  )
}
