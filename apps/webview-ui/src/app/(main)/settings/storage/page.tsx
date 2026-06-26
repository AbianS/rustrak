import { Database, FileCode2, Layers, ListTree, ShieldX } from 'lucide-react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getCurrentUser } from '@/actions/auth';
import { getProjects } from '@/actions/projects';
import { getStorageProjects, getStorageSummary } from '@/actions/storage';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatBytes } from '@/lib/utils';
import { SourceMapGc } from './source-map-gc';
import { StorageCleanup } from './storage-cleanup';
import {
  CleanupSkeleton,
  ProjectsTableSkeleton,
  SummaryCardsSkeleton,
} from './storage-skeletons';

export const metadata: Metadata = {
  title: 'Storage | Rustrak',
  description: 'Storage usage and data retention',
};

function PageHeader() {
  return (
    <div className="mb-6 md:mb-8">
      <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
        Storage
      </h1>
      <p className="text-muted-foreground mt-1">
        See what Rustrak is holding and reclaim space by cleaning up old data
      </p>
    </div>
  );
}

/**
 * Overview cards. Owns its own (heavy) summary query so it can stream in behind
 * a skeleton without blocking the rest of the page.
 */
async function SummaryCards() {
  const summary = await getStorageSummary();

  const cards = [
    {
      label: 'Database size',
      value: formatBytes(summary.total_db_size_bytes),
      sub: `${summary.events_count.toLocaleString()} events`,
      icon: Database,
    },
    {
      label: 'Transactions',
      value: summary.transactions_count.toLocaleString(),
      sub: `${summary.spans_count.toLocaleString()} spans`,
      icon: ListTree,
    },
    {
      label: 'Spans',
      value: summary.spans_count.toLocaleString(),
      sub: 'indexed from transactions',
      icon: Layers,
    },
    {
      label: 'Source maps',
      value: formatBytes(summary.source_maps.total_bytes),
      sub: `${summary.source_maps.file_count.toLocaleString()} files`,
      icon: FileCode2,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} size="sm">
            <CardContent>
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Icon className="size-3.5" />
                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  {card.label}
                </span>
              </div>
              <p className="text-xl font-extrabold tracking-tight leading-tight">
                {card.value}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">{card.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/**
 * Per-project breakdown table. Owns the heavy per-project aggregation query and
 * streams in independently of the cards above.
 */
async function ProjectsTable() {
  const projects = await getStorageProjects();

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>By project</CardTitle>
        <CardDescription>
          Counts and estimated weight of the data each project holds
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Mobile: card list */}
        <div className="md:hidden space-y-3">
          {projects.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              No projects yet.
            </p>
          ) : (
            projects.map((p) => (
              <div
                key={p.project_id}
                className="rounded-lg border p-3 space-y-2"
              >
                <p className="text-sm font-medium">{p.project_name}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Events</span>
                  <span className="tabular-nums text-right">
                    {p.events_count.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">Transactions</span>
                  <span className="tabular-nums text-right">
                    {p.transactions_count.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">Spans</span>
                  <span className="tabular-nums text-right">
                    {p.spans_count.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">Source maps</span>
                  <span className="tabular-nums text-right">
                    {p.source_maps_count.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">Est. size</span>
                  <span className="tabular-nums text-right">
                    {formatBytes(p.estimated_bytes)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop: table */}
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Project</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Spans</TableHead>
              <TableHead className="text-right">Source maps</TableHead>
              <TableHead className="text-right">Est. size</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground py-8"
                >
                  No projects yet.
                </TableCell>
              </TableRow>
            ) : (
              projects.map((p) => (
                <TableRow key={p.project_id}>
                  <TableCell className="font-medium">
                    {p.project_name}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.events_count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.transactions_count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.spans_count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.source_maps_count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBytes(p.estimated_bytes)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/**
 * Cleanup panel. Uses the lightweight projects list (id + name) for its scope
 * selector instead of waiting on the heavy per-project storage aggregation, so
 * it can stream in early.
 */
async function CleanupPanel() {
  // Fetch every project in one shot (the API applies no hard page-size cap) so
  // the scope selector never silently drops projects.
  const { items } = await getProjects({ per_page: 10000 });

  return (
    <StorageCleanup projects={items.map((p) => ({ id: p.id, name: p.name }))} />
  );
}

export default async function StoragePage() {
  const user = await getCurrentUser();

  // Guard: storage usage and cleanup are instance-admin only.
  if (user?.role !== 'admin') {
    return (
      <>
        <PageHeader />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShieldX className="size-12 text-muted-foreground/50 mb-4" />
            <p className="font-semibold">Not authorized</p>
            <p className="text-muted-foreground mt-1 text-sm max-w-sm">
              Only instance administrators can view storage usage and run
              cleanups. Contact an admin if you need access.
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  // The page shell + header render immediately. Each data-heavy section owns its
  // own query inside a Suspense boundary, so they stream in independently behind
  // skeletons instead of the whole page blocking on a single await.
  return (
    <>
      <PageHeader />

      <Suspense fallback={<SummaryCardsSkeleton />}>
        <SummaryCards />
      </Suspense>

      <Suspense fallback={<ProjectsTableSkeleton />}>
        <ProjectsTable />
      </Suspense>

      <div className="space-y-6">
        <Suspense fallback={<CleanupSkeleton />}>
          <CleanupPanel />
        </Suspense>
        <SourceMapGc />
      </div>
    </>
  );
}
