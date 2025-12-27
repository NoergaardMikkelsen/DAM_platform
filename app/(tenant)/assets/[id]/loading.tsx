import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex min-h-screen bg-[#f5f5f6] text-gray-900">
      {/* Main wrapper keeps content separate from sidebar */}
      <div className="relative flex min-h-screen flex-1">
        <div className="relative mx-auto flex w-full max-w-5xl flex-col px-6 pb-32 pt-6">
          {/* Header skeleton */}
          <div className="mb-6 flex w-full items-center justify-between text-sm text-gray-500 relative">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-5 w-32" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>

          {/* Main content area skeleton */}
          <div className="flex flex-1 items-center justify-center min-h-0">
            <div className="w-full flex items-center justify-center">
              {/* Large media preview skeleton */}
              <div className="w-full">
                <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
              </div>
            </div>
          </div>

          {/* Bottom navigation skeleton */}
          <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center">
            <div className="pointer-events-auto px-4">
              <div className="inline-flex items-center justify-center gap-3 rounded-[18px] border border-gray-200 bg-white/96 px-4 py-3 backdrop-blur sm:px-5">
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-20" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

