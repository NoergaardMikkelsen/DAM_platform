import { AssetGridSkeleton, CollectionGridSkeleton, PageHeaderSkeleton, SectionHeaderSkeleton } from "@/components/skeleton-loaders"

export default function Loading() {
  return (
    <div className="p-8">
      <PageHeaderSkeleton showSearch={true} />

      {/* Collections section skeleton - match maxCollections (typically 4 on desktop) */}
      <div className="mb-10">
        <SectionHeaderSkeleton showSort={true} />
        <CollectionGridSkeleton count={4} />
      </div>

      {/* Assets section skeleton - match minimum shown (12) */}
      <div>
        <SectionHeaderSkeleton showSort={true} />
        <AssetGridSkeleton count={12} />
      </div>
    </div>
  )
}
