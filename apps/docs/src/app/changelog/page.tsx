import type { Metadata } from 'next';
import { importPage } from 'nextra/pages';
import { formatDateShort, getReleases } from '@/lib/changelog';

export const metadata: Metadata = {
  title: 'Changelog',
  description: 'Release notes and version history for the Rustrak project.',
};

function DotIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor">
      <circle cx="8" cy="8" r="4" />
    </svg>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
      {label}
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold tracking-widest uppercase text-neutral-400 dark:text-neutral-500 mb-6 flex items-center gap-3">
      <span>{children}</span>
      <span className="flex-1 h-px bg-neutral-200 dark:bg-neutral-800" />
    </h2>
  );
}

export default async function ChangelogPage() {
  const releases = getReleases();

  const mdxModules = await Promise.all(
    releases.map((r) =>
      importPage(['changelog', r.slug]).catch(() => ({ default: null })),
    ),
  );

  const grouped = releases.reduce(
    (acc, r) => {
      const year = r.date.slice(0, 4);
      if (!acc[year]) acc[year] = [];
      acc[year].push(r);
      return acc;
    },
    {} as Record<string, typeof releases>,
  );

  const years = Object.keys(grouped).sort((a, b) => Number(b) - Number(a));

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-16">
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3">
          Changelog
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400">
          Every release of Rustrak, from the first commit to the latest feature.
        </p>
      </div>

      <div className="relative">
        <div className="absolute left-3.75 top-3 bottom-3 w-px bg-neutral-200 dark:bg-neutral-800" />

        {years.map((year) => (
          <div key={year} className="mb-16 last:mb-0">
            <div className="relative pl-12 mb-10">
              <div className="absolute left-0 top-0 flex items-center justify-center w-7.75 h-7.75 rounded-full bg-neutral-100 dark:bg-neutral-800 border-2 border-white dark:border-neutral-950 z-10">
                <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  {year.slice(2)}
                </span>
              </div>
              <SectionHeading>{year}</SectionHeading>
            </div>

            <div className="space-y-14">
              {grouped[year].map((release) => {
                const idx = releases.indexOf(release);
                const MDXContent = mdxModules[idx]?.default;

                return (
                  <div key={release.slug} className="relative pl-12 group">
                    <div className="absolute left-0 top-1 flex items-center justify-center w-7.75 h-7.75 rounded-full bg-white dark:bg-neutral-950 border-2 border-neutral-300 dark:border-neutral-700 z-10 group-hover:border-primary transition-colors duration-200">
                      <DotIcon />
                    </div>

                    <div className="min-w-0 pt-1">
                      <div className="flex flex-wrap items-center gap-2.5 mb-3">
                        <span className="font-mono text-sm font-bold tracking-tight text-primary bg-primary/10 dark:bg-primary/20 px-2.5 py-0.5 rounded-md">
                          {release.version}
                        </span>
                        <time
                          className="text-sm text-neutral-400 dark:text-neutral-500"
                          dateTime={release.date}
                        >
                          {formatDateShort(release.date)}
                        </time>
                        {release.tags.map((tag) => (
                          <Tag key={tag} label={tag} />
                        ))}
                      </div>

                      <h3 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mb-3">
                        {release.title}
                      </h3>

                      {release.description && (
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5 leading-relaxed">
                          {release.description}
                        </p>
                      )}

                      {MDXContent && (
                        <article className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary prose-code:font-mono prose-headings:text-base prose-headings:mt-0 prose-p:text-sm prose-p:leading-relaxed prose-p:text-neutral-600 dark:prose-p:text-neutral-400 prose-ul:mt-2 prose-li:text-sm prose-li:leading-relaxed prose-li:text-neutral-600 dark:prose-li:text-neutral-400 prose-hr:my-6">
                          <MDXContent />
                        </article>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
