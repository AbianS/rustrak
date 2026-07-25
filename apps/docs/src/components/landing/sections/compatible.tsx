import { Band } from '../primitives/grid';

/**
 * The SDK strip. Names set in type rather than a wall of vendor logos: none of
 * these projects endorse Rustrak, and a grid of their marks would imply they
 * do. What is being claimed is narrower and true, which is that their official
 * Sentry SDKs point at this server unchanged.
 */
const SDKS = [
  'JavaScript',
  'Node.js',
  'Python',
  'Go',
  'Rust',
  'Java',
  '.NET',
  'PHP',
  'Ruby',
  'Elixir',
];

export function Compatible() {
  return (
    <Band>
      <p className="border-b border-rule px-5 py-5 text-center text-[13px] text-muted-foreground sm:px-10 sm:py-6 sm:text-[13.5px]">
        Point any official Sentry SDK at your own server. No forks, no shims.
      </p>

      {/*
        Rules are drawn only where a cell has a neighbour, so the strip closes
        flush against the frame instead of doubling its lines. Two columns
        becomes five at `lg`, and each case is spelled out as a literal class:
        Tailwind scans source text, so a class name assembled from a variable
        prefix is never generated.
      */}
      <ul className="grid grid-cols-2 lg:grid-cols-5">
        {SDKS.map((sdk, index) => (
          <li
            key={sdk}
            className={[
              'border-rule px-4 py-6 text-center text-[14px] text-white/55 sm:px-6 sm:py-8 sm:text-[15px]',
              index % 2 === 0
                ? index % 5 === 4
                  ? 'border-r lg:border-r-0'
                  : 'border-r'
                : index % 5 === 4
                  ? ''
                  : 'lg:border-r',
              index < 5
                ? 'border-b'
                : index < 8
                  ? 'border-b lg:border-b-0'
                  : '',
            ].join(' ')}
          >
            {sdk}
          </li>
        ))}
      </ul>
    </Band>
  );
}
