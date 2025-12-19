import { DetailPageHeaderSkeleton, FormSkeleton, StatsCardsSkeleton } from "@/components/skeleton-loaders"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="p-8">
      <DetailPageHeaderSkeleton showActions={true} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Information Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle><Skeleton className="h-6 w-32" /></CardTitle>
            <CardDescription><Skeleton className="h-4 w-48" /></CardDescription>
          </CardHeader>
          <CardContent>
            <FormSkeleton fields={5} />
          </CardContent>
        </Card>

        {/* Stats Cards Skeleton */}
        <StatsCardsSkeleton count={3} />
      </div>
    </div>
  )
}

