import { lazy, Suspense } from 'react';

/**
 * The project's platform logo, loaded apart from the page.
 *
 * `platformicons` resolves its icon from a runtime string, so every one of its
 * 446 SVGs is reachable and all of them bundle: measured at **154 kB gzipped**,
 * more than the rest of this route put together. Behind `lazy` they become
 * their own chunk, fetched after the table has painted and cached from then on.
 *
 * The fallback is a box of the same size, so nothing moves when the logos land.
 */
const PlatformIcon = lazy(async () => {
  const { PlatformIcon: Icon } = await import('platformicons');
  return { default: Icon };
});

export function PlatformMark({
  platform,
  size = 28,
}: {
  platform: string | null;
  size?: number;
}) {
  return (
    <Suspense
      fallback={
        <span
          className="block shrink-0 rounded-[5px] bg-surface-chip"
          style={{ width: size, height: size }}
        />
      }
    >
      <PlatformIcon
        className="shrink-0"
        format="lg"
        // The same mark webview-ui uses, so a project looks like itself in
        // both dashboards. `other` is the package's own generic icon.
        platform={platform ?? 'other'}
        radius={5}
        size={size}
      />
    </Suspense>
  );
}
