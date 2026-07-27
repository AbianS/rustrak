import type { Metadata } from 'next';
import { Suspense } from 'react';
import { getProject } from '@/actions/projects';
import { LoadFailure } from '@/components/load-failure';
import { parseOverviewPeriod } from '@/lib/session-health';
import { OverviewPeriodFilter } from './overview-period-filter';
import {
  CounterTiles,
  CrashFreeTile,
  ErrorVolumeTile,
  PerformanceTile,
  SessionHealthTile,
  TileSkeleton,
  TopIssuesTile,
} from './overview-tiles';
import { ProjectHeader } from './project-header';

interface ProjectPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}

export async function generateMetadata({
  params,
}: ProjectPageProps): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(parseInt(id, 10));

  if (!project.success) {
    return { title: 'Project Not Found | Rustrak' };
  }

  return {
    title: `${project.data.name} | Rustrak`,
    description: `Overview for ${project.data.name}`,
  };
}

export default async function ProjectPage({
  params,
  searchParams,
}: ProjectPageProps) {
  const { id } = await params;
  const { period: rawPeriod } = await searchParams;
  const projectId = parseInt(id, 10);

  // An unrecognized window would otherwise reach the API, which ignores what
  // it cannot parse and answers with all-time data while no filter button
  // reads as selected. Drop it instead, so the URL and the UI always agree.
  const period = parseOverviewPeriod(rawPeriod);

  const projectResult = await getProject(projectId);

  if (!projectResult.success) {
    return (
      <LoadFailure error={projectResult.error} title="Could not load project" />
    );
  }

  const project = projectResult.data;
  const tile = { projectId, period };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-auto">
      <div className="w-full shrink-0 border-b px-4 py-4 md:px-8 md:py-6">
        <ProjectHeader project={project} />
      </div>

      {/*
        Bento grid: tile size is the hierarchy. The error-volume chart is the
        one thing worth looking at first, so it takes four times the area of a
        counter tile; everything else orbits it. One uniform gap throughout.
      */}
      <div className="flex w-full flex-1 flex-col gap-4 px-4 py-4 md:px-8 md:py-6">
        <OverviewPeriodFilter projectId={projectId} activePeriod={period} />

        {/*
          min-w-0 on every cell that holds a chart: a grid item defaults to
          min-width:auto, so a ResponsiveContainer's measured width can pin its
          column open and the whole page ends up scrolling sideways on a phone.
        */}
        <div className="grid gap-4 xl:grid-cols-4">
          <div className="min-w-0 xl:col-span-2">
            <Suspense fallback={<TileSkeleton height={300} />}>
              <ErrorVolumeTile {...tile} />
            </Suspense>
          </div>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:col-span-2">
            {/* Both counters come from one query, so they share a boundary. */}
            <Suspense
              fallback={
                <>
                  <TileSkeleton height={56} />
                  <TileSkeleton height={56} />
                </>
              }
            >
              <CounterTiles {...tile} />
            </Suspense>
            <div className="min-w-0 sm:col-span-2">
              <Suspense fallback={<TileSkeleton height={132} />}>
                <CrashFreeTile {...tile} />
              </Suspense>
            </div>
          </div>

          <div className="min-w-0 xl:col-span-3">
            <Suspense fallback={<TileSkeleton height={250} />}>
              <SessionHealthTile {...tile} />
            </Suspense>
          </div>

          <div className="min-w-0">
            <Suspense fallback={<TileSkeleton height={250} />}>
              <PerformanceTile {...tile} />
            </Suspense>
          </div>

          <div className="min-w-0 xl:col-span-4">
            <Suspense fallback={<TileSkeleton height={180} />}>
              <TopIssuesTile {...tile} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
