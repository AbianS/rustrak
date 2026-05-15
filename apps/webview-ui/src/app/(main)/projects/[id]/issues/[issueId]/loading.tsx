import { Skeleton } from '@/components/ui/skeleton';

function SidebarCardSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="bg-card rounded-xl border p-6 space-y-4">
      <Skeleton className="h-3 w-28" />
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EventLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header */}
      <header className="shrink-0 bg-background border-b">
        <div className="max-w-400 w-full mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Skeleton className="h-5 w-14 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-36" />
              </div>
              <Skeleton className="h-7 w-4/5" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="flex flex-row flex-wrap items-center gap-2 md:flex-col md:items-end md:gap-3">
              <Skeleton className="h-9 w-52 rounded-lg" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-24 rounded-md" />
                <Skeleton className="h-9 w-20 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-400 w-full mx-auto px-4 md:px-8 py-4 md:py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
            {/* Main — tabs + content */}
            <div className="lg:col-span-8 space-y-6">
              {/* Tabs bar */}
              <div className="flex items-center gap-1 bg-muted rounded-lg p-1 h-9 w-fit">
                {[
                  'Stack Trace',
                  'Breadcrumbs',
                  'Details',
                  'Tags',
                  'Context',
                  'Raw',
                ].map((tab) => (
                  <Skeleton
                    key={tab}
                    className="h-7 rounded-md"
                    style={{ width: `${tab.length * 7 + 16}px` }}
                  />
                ))}
              </div>

              {/* Stack trace skeleton */}
              <div className="space-y-3">
                <Skeleton className="h-6 w-56" />
                <Skeleton className="h-4 w-80" />
              </div>

              {[true, false, false, true, false].map((inApp, i) => (
                <div
                  key={i}
                  className={`border rounded-lg p-4 space-y-2 ${inApp ? 'border-primary/30' : 'opacity-50'}`}
                >
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-4 w-6" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-72" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sidebar */}
            <aside className="lg:col-span-4 space-y-6">
              {/* Issue Statistics */}
              <div className="bg-card rounded-xl border p-6 space-y-4">
                <Skeleton className="h-3 w-28" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
              </div>

              <SidebarCardSkeleton rows={3} />
              <SidebarCardSkeleton rows={2} />
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
