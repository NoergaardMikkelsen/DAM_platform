import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import Link from 'next/link'

// Individual asset card skeleton - matches actual asset card size
export function AssetCardSkeleton() {
  return (
    <Link href="#" className="w-full" onClick={(e) => e.preventDefault()}>
      <Card className="group overflow-hidden p-0 transition-shadow w-full" style={{ borderRadius: '20px' }}>
        <div className="relative bg-gradient-to-br from-gray-100 to-gray-200 w-full" style={{ aspectRatio: '1 / 1', borderRadius: '20px' }}>
          <div className="animate-pulse w-full h-full bg-gray-200" style={{ borderRadius: '20px' }} />
          <button
            className="absolute bottom-2 right-2 h-[48px] w-[48px] rounded-full opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center"
            style={{
              backgroundColor: '#E5E5E5',
            }}
          >
            <svg
              viewBox="0 8 25 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid"
              style={{
                width: '22px',
                height: '18px',
              }}
            >
              <path
                d="M5.37842 18H19.7208M19.7208 18L15.623 22.5M19.7208 18L15.623 13.5"
                stroke="black"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          </button>
        </div>
      </Card>
    </Link>
  )
}

// Asset grid skeleton with dynamic count
export function AssetGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="gap-4 sm:gap-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="w-full">
          <AssetCardSkeleton />
        </div>
      ))}
    </div>
  )
}

// Collection card skeleton with complex shape - matches actual collection card size
export function CollectionCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div className="block w-full">
      <div 
        className="relative w-full aspect-[239/200] overflow-hidden" 
        style={{ 
          containerType: 'inline-size',
        }}
      >
        <svg viewBox="0 0 239 200" className="w-full h-full absolute inset-0" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
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
    </div>
  )
}

// Collection grid skeleton with dynamic count
export function CollectionGridSkeleton({ count = 4, useAutoFill = false }: { count?: number; useAutoFill?: boolean }) {
  if (useAutoFill) {
    // For collections page - matches the dynamic grid layout
    return (
      <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 260px))' }}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="w-full">
            <CollectionCardSkeleton index={i} />
          </div>
        ))}
      </div>
    )
  }
  
  // For dashboard and assets library - matches the fixed grid layout (max 4 columns)
  return (
    <div className="gap-4 sm:gap-6 grid grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="w-full">
          <CollectionCardSkeleton index={i} />
        </div>
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
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-32 hidden sm:block" />
      </div>
      {showSort && (
        <Skeleton className="h-8 w-full sm:w-[180px]" />
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
        <div key={i} className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  )
}

// Table skeleton
export function TableSkeleton({ rows = 8, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden" style={{ borderRadius: '0 20px 20px 20px', background: '#FFF' }}>
      <table className="w-full">
        {/* Table Header */}
        <thead>
          <tr className="rounded-[20px] bg-[#F9F9F9]">
            {Array.from({ length: columns }, (_, j) => (
              <th key={j} className="px-6 py-3 text-left text-sm font-medium text-gray-900 first:pl-6 last:pr-6">
                <Skeleton className="h-4 w-24" />
              </th>
            ))}
          </tr>
        </thead>
        {/* Table Rows */}
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} className="border-b border-gray-100 last:border-b-0">
              {Array.from({ length: columns }, (_, j) => (
                <td key={j} className={`px-6 py-4 ${j === columns - 1 ? 'text-right' : ''}`}>
                  <Skeleton className={`h-4 ${j === columns - 1 ? 'w-20 ml-auto' : 'w-full max-w-48'}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
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
  const getTabStyles = (index: number) => {
    const grayColors = ["#DADADA", "#EAEAEA", "#F3F2F2"]
    const transforms = ["translateX(0)", "translateX(2px)", "translateX(4px)", "translateX(6px)", "translateX(8px)"]
    const zIndexes = [5, 4, 3, 2, 1]
    
    const grayIndex = Math.min(index, 2)
    const transformIndex = Math.min(index, 4)
    const zIndex = index < 5 ? zIndexes[index] : 1
    
    return {
      backgroundColor: grayColors[grayIndex],
      transform: transforms[transformIndex],
      zIndex,
      marginRight: index < count - 1 ? '-8px' : '0',
      boxShadow: '2px 3px 5px 0 rgba(0, 0, 0, 0.05)',
      borderRadius: 0,
      maskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='119' height='33' viewBox='0 0 119 33' preserveAspectRatio='none'%3E%3Cpath d='M0 20C0 8.9543 8.95431 0 20 0H92.9915C101.402 0 108.913 5.26135 111.787 13.1651L119 33H0V20Z' fill='black'/%3E%3C/svg%3E")`,
      WebkitMaskImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='119' height='33' viewBox='0 0 119 33' preserveAspectRatio='none'%3E%3Cpath d='M0 20C0 8.9543 8.95431 0 20 0H92.9915C101.402 0 108.913 5.26135 111.787 13.1651L119 33H0V20Z' fill='black'/%3E%3C/svg%3E")`,
      maskSize: '100% 100%',
      WebkitMaskSize: '100% 100%',
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskPosition: 'center',
      WebkitMaskPosition: 'center',
    }
  }

  return (
    <div className="mb-0 inline-flex h-[35px] items-end gap-0 overflow-visible">
      {Array.from({ length: count }, (_, i) => {
        const styles = getTabStyles(i)
        return (
          <div
            key={i}
            data-slot="tabs-trigger"
            className="relative h-[35px] w-24 overflow-visible border-none"
            style={styles}
          >
            <div className="h-full w-full animate-pulse bg-gray-300/30" />
          </div>
        )
      })}
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
    <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-white rounded-[20px] p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-5 w-12" />
          </div>
          {i === 0 && <Skeleton className="h-2 w-full rounded-full" />}
        </div>
      ))}
    </div>
  )
}
