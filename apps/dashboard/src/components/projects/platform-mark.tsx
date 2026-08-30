import { lazy, Suspense } from 'react';

/**
 * The project's platform logo, loaded apart from the page.
 *
 * `platformicons` resolves its icon from a runtime string, so every one of its
 * 446 SVGs is reachable and all of them bundle: measured at **154 kB gzipped**,
 * more than the rest of this route put together. Behind `lazy` they become
 * their own chunk, fetched after the table has painted and cached from then on.
 *
 * The fallback is the same 28px box, so the row does not move when the logos
 * land.
 */
const PlatformIcon = lazy(async () => {
  const { PlatformIcon: Icon } = await import('platformicons');
  return { default: Icon };
});

const BOX = 'size-7 shrink-0 rounded-[5px]';

export function PlatformMark({ platform }: { platform: string | null }) {
  return (
    <Suspense fallback={<span className={`${BOX} bg-surface-chip`} />}>
      <PlatformIcon
        className="shrink-0"
        format="lg"
        // The same mark webview-ui uses, so a project looks like itself in
        // both dashboards. `other` is the package's own generic icon.
        platform={platform ?? 'other'}
        radius={5}
        size={28}
      />
    </Suspense>
  );
}
