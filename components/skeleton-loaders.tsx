import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight } from 'lucide-react'

// Individual asset card skeleton
export function AssetCardSkeleton() {
  return (
    <Card className="group overflow-hidden p-0 transition-shadow hover:shadow-lg mb-6 break-inside-avoid">
      <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse" style={{ aspectRatio: '4/5' }}>
        <Button
          variant="ghost"
          size="icon"
          className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-white/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
        >
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  )
}

// Asset grid skeleton with dynamic count
export function AssetGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-4 gap-6">
      {Array.from({ length: count }, (_, i) => (
        <AssetCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Collection card skeleton with complex shape
export function CollectionCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="relative w-full min-w-[200px] aspect-[239/200] overflow-hidden">
      <svg viewBox="0 0 239 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <mask id={`skeletonMask-collection-${index}`} maskUnits="userSpaceOnUse" x="0" y="0" width="239" height="200">
            <path
              d="M0 179V21C0 9.40202 9.40202 0 21 0H216.195C227.67 0 237.02 9.17764 237.181 20.652C237.598 50.258 238.304 103.407 238.304 123.5C238.304 152 206.152 133 188.658 156C171.163 179 193.386 200 144.499 200H20.9761C9.37811 200 0 190.598 0 179Z"
              fill="white"
            />
          </mask>
        </defs>
        <rect x="0" y="0" width="239" height="200" fill="#e5e7eb" mask={`url(#skeletonMask-collection-${index})`} className="animate-pulse" />
      </svg>
    </div>
  )
}

// Collection grid skeleton with dynamic count
export function CollectionGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      {Array.from({ length: count }, (_, i) => (
        <CollectionCardSkeleton key={i} index={i} />
      ))}
    </div>
  )
}

// Page header skeleton
export function PageHeaderSkeleton({ showBackLink = false, showSearch = false }: { showBackLink?: boolean; showSearch?: boolean }) {
  return (
    <div className="mb-8">
      {showBackLink && (
        <Skeleton className="mb-4 h-4 w-32" />
      )}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        {showSearch && (
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-64" />
          </div>
        )}
      </div>
    </div>
  )
}

// Section header skeleton
export function SectionHeaderSkeleton({ showSort = false }: { showSort?: boolean }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      {showSort && (
        <Skeleton className="h-10 w-48" />
      )}
    </div>
  )
}

// Sorting skeleton
export function SortingSkeleton() {
  return (
    <div className="mb-6 flex items-center justify-end">
      <Skeleton className="h-10 w-48" />
    </div>
  )
}

// Detail page header skeleton (with back link, title, and actions)
export function DetailPageHeaderSkeleton({ showActions = true }: { showActions?: boolean }) {
  return (
    <div className="mb-8">
      <Skeleton className="mb-4 h-4 w-32" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div>
            <Skeleton className="h-9 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        {showActions && (
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
          </div>
        )}
      </div>
    </div>
  )
}

// Form skeleton for editing sections
export function FormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  )
}

// Stats cards skeleton
export function StatsCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-6 w-24" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-4 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Table skeleton
export function TableSkeleton({ rows = 8, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center space-x-4">
          {Array.from({ length: columns }, (_, j) => (
            <Skeleton key={j} className={`h-4 ${j === 0 ? 'w-32' : j === columns - 1 ? 'w-16' : 'w-24'}`} />
          ))}
        </div>
      ))}
    </div>
  )
}

// List page header skeleton (title + create button)
export function ListPageHeaderSkeleton({ showCreateButton = true }: { showCreateButton?: boolean }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <Skeleton className="h-9 w-32" />
      {showCreateButton && (
        <Skeleton className="h-10 w-40" />
      )}
    </div>
  )
}

// Search skeleton
export function SearchSkeleton() {
  return (
    <div className="mb-6">
      <div className="relative max-w-md">
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}

// Tabs skeleton
export function TabsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="mb-6 flex space-x-2">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-10 w-20" />
      ))}
    </div>
  )
}

// Dashboard header skeleton
export function DashboardHeaderSkeleton() {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <Skeleton className="h-9 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-10 w-24" />
    </div>
  )
}

// Stats cards grid skeleton
export function StatsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2" />
            {i === 0 && <Skeleton className="h-2 w-full" />}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
