import { Band, Cell } from '@/components/frame/grid';
import { Heading, Pill } from '../primitives/heading';

/**
 * Targets, not measurements. These are the budgets the server is built and
 * tested against, which is what the label says — publishing them as achieved
 * throughput would be a claim nobody has benchmarked on the reader's hardware.
 *
 * The statement above them used to end "It runs beside your app on the box you
 * already pay for", which is wrong twice: Rustrak keeps its own database rather
 * than sharing the application's, and where it is deployed is the operator's
 * choice, with a separate VPS being an ordinary one. Both databases are named
 * outright now because the install band below defaults to the SQLite tab, and a
 * reader who has just been told "one binary and a database" and then meets two
 * tabs has been left to work out which one the page meant.
 */
const NUMBERS = [
  { value: '<100MB', label: 'Resident memory, idle' },
  { value: '<50ms', label: 'Ingest latency, P99' },
  { value: '10k/s', label: 'Events per second, target' },
  { value: '<20MB', label: 'Container image, distroless' },
];

export function Scale() {
  return (
    <Band>
      <Cell className="max-w-[52rem]">
        <Pill>Footprint</Pill>
        <Heading
          className="display-lg mt-6"
          lead="It fits on the cheapest machine you have."
          rest="One Rust binary, SQLite out of the box, PostgreSQL when you need it, and nothing else to install."
          scrub
        />
      </Cell>

      {/*
        Two up on a phone rather than four stacked. These are four readings of
        one instrument and the comparison is the point; a single column turns
        them into a scroll, and each figure is short enough that half a phone
        is plenty of room for it.

        Rules are drawn only where a cell has a neighbour, and each case is
        spelled out as a literal class: Tailwind scans source text, so a class
        name assembled from a variable prefix is never generated.
      */}
      <ul className="grid grid-cols-2 border-t border-rule lg:grid-cols-4">
        {NUMBERS.map((item, index) => (
          <li
            key={item.value}
            className={[
              'border-rule px-4 py-9 sm:px-10 sm:py-12',
              // Right rule on the left of each pair, and on all but the last
              // once the row is four wide.
              index === 1 ? 'lg:border-r' : index === 3 ? '' : 'border-r',
              // The first pair closes against the second; four across, there
              // is no second row to close against.
              index < 2 ? 'border-b lg:border-b-0' : '',
            ].join(' ')}
          >
            {/* The short rule is the reference's tell for a figure: it turns a
                number into a labelled entry rather than a floating stat. */}
            <div className="border-l-2 border-primary pl-3 sm:pl-4">
              <p className="font-mono text-[25px] leading-none tracking-tight text-foreground sm:text-[30px]">
                {item.value}
              </p>
              <p className="mt-2.5 text-[12.5px] text-muted-foreground sm:text-[13.5px]">
                {item.label}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Band>
  );
}
