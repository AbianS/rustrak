import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Fallback for the overview cards while the storage summary loads. */
export function SummaryCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} size="sm">
          <CardContent>
            <div className="flex items-center gap-1.5 mb-1">
              <Skeleton className="size-3.5 rounded" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-24 mt-1" />
            <Skeleton className="h-3 w-16 mt-1.5" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Fallback for the per-project breakdown table while it loads. */
export function ProjectsTableSkeleton() {
  return (
    <Card className="mb-6">
      <CardHeader>
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-72 mt-1" />
      </CardHeader>
      <CardContent>
        {/* Mobile */}
        <div className="md:hidden space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12 ml-auto" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12 ml-auto" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12 ml-auto" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-12 ml-auto" />
                <Skeleton className="h-3 w-14" />
                <Skeleton className="h-3 w-12 ml-auto" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-12 ml-auto" />
              </div>
            </div>
          ))}
        </div>

        {/* Desktop */}
        <div className="hidden md:block space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Fallback for the cleanup panel while the project list loads. */
export function CleanupSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-80 mt-1" />
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-3">
          <Skeleton className="h-9 w-full sm:w-56" />
          <Skeleton className="h-9 w-full sm:w-56" />
          <Skeleton className="h-9 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}
