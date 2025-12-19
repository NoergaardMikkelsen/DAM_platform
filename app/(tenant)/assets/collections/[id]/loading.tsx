import { PageHeaderSkeleton, SortingSkeleton, AssetGridSkeleton } from "@/components/skeleton-loaders"

export default function Loading() {
  return (
    <div className="p-8">
      <PageHeaderSkeleton showBackLink={true} showSearch={true} />
      <SortingSkeleton />
      <AssetGridSkeleton count={20} />
    </div>
  )
}
