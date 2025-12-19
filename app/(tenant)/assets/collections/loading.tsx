import { PageHeaderSkeleton, SortingSkeleton, CollectionGridSkeleton } from "@/components/skeleton-loaders"

export default function Loading() {
  return (
    <div className="p-8">
      <PageHeaderSkeleton showBackLink={true} showSearch={true} />
      <SortingSkeleton />
      <CollectionGridSkeleton count={12} />
    </div>
  )
}
