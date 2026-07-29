'use client';

import { useState } from 'react';
import {
  formatReleaseDate,
  type ReleasePulse,
  type SectionKind,
} from '@/lib/release';
import { cn } from '@/lib/utils';

/**
 * The whole release history, drawn.
 *
 * ── What it is ─────────────────────────────────────────────────────────────
 *
 * One column per release, oldest on the left. A column's height is how many
 * changes that release carried and its banding is what kind they were, so the
 * shape of the project is legible before a word of it is read: the tall lime
 * columns are the minors that added something, the short amber ones are the
 * patches that fixed something, and how far apart the axis marks fall is how
 * fast the thing moved.
 *
 * ── Why the page needed it ─────────────────────────────────────────────────
 *
 * A changelog with forty-one entries and no map is a scroll with no bottom. The
 * previous design spent a twelve-rem column on two tag chips and gave a reader
 * arriving on a wide monitor nothing to navigate with; this is that width spent
 * on the one thing a changelog reader actually wants, which is to get to a
 * version. It is a picture and an index at once, and it costs about 5KB of data
 * because a column only needs five numbers to draw.
 *
 * ── The two variants ───────────────────────────────────────────────────────
 *
 * `full` sits in the page header at reading size, with a time axis under it.
 * `strip` is the same drawing at 18px, pinned under the navbar once the header
 * has gone by. The history becomes the scrollbar, and the lit column is where
 * you are. That is the whole idea: the navigation is not a widget bolted to the
 * page, it is the data.
 *
 * Every column is a real `<a href="#v0-13-0">`, so the map works before
 * hydration and a middle click opens a release in a tab. The click handler is
 * an interception for one case only: a release too old to be on the page yet,
 * which has to be fetched before it can be scrolled to.
 */

/**
 * Bottom to top. `shipped` sits at the base because it is the part of a release
 * a reader is looking for; stacking fixes under features would bury the signal
 * under the noise in exactly the releases that have most of both.
 *
 * ── Why the greys are so faint ─────────────────────────────────────────────
 *
 * They were `foreground/30` and `foreground/15`, and drawn that way the band
 * came out grey. Nearly every release has an "Improvements" section, so the
 * grey is the one band present in almost every column, and at 30% on white it
 * out-weighed the lime beside it. Forty-one columns of mud with some green in
 * them. Only two things in this drawing are worth a reader's eye, what a
 * release added and what it fixed, and now only those two carry colour. The
 * greys are a ground for them to sit on.
 *
 * Written as literal classes rather than assembled from the kind, because
 * Tailwind scans source text and never generates a class built from a variable.
 */
const KIND_FILL: Record<SectionKind, string> = {
  shipped: 'bg-primary',
  improved: 'bg-foreground/14',
  // The one colour that needs saying twice. A translucent amber composites
  // against whatever is behind it, and behind it is white in one theme and
  // near-black in the other: `amber-500/55` is a clean pale gold on the light
  // page and a muddy brown on the dark one. The greys and the lime do not have
  // this problem: the greys are mixed from `--foreground`, which flips with
  // the theme, and the lime is opaque.
  fixed: 'bg-amber-500/55 dark:bg-amber-400/75',
  documented: 'bg-foreground/7',
};

/**
 * The same four, as legend chips.
 *
 * They are stronger than the bands they stand for, and deliberately. A band is
 * a shape twenty pixels wide and the eye reads its *area*; a chip is an eight
 * pixel square, and `foreground/7` at that size is an empty space next to a
 * number. The chip's job is to say which category the count belongs to, which
 * it cannot do while being invisible.
 */
const KIND_CHIP: Record<SectionKind, string> = {
  shipped: 'bg-primary',
  improved: 'bg-foreground/35',
  fixed: 'bg-amber-500/80 dark:bg-amber-400/90',
  documented: 'bg-foreground/18',
};

const KIND_ORDER: SectionKind[] = [
  'documented',
  'fixed',
  'improved',
  'shipped',
];

const KIND_LABEL: Record<SectionKind, string> = {
  shipped: 'Shipped',
  improved: 'Improved',
  fixed: 'Fixed',
  documented: 'Docs',
};

/**
 * The shortest column as a fraction of the tallest.
 *
 * Purely linear, a two-change patch next to a twenty-two-change minor is nine
 * percent of the track, two pixels in the strip, which reads as a gap in the
 * history rather than as a release. The floor buys the small ones a presence
 * without flattening the difference: across this archive the range still runs
 * about four to one, which is the ratio that carries the meaning.
 */
const MIN_HEIGHT = 0.17;

/**
 * How close two axis labels may sit, as a fraction of the band.
 *
 * A label is a tick, a gap and three or four monospaced characters: call it
 * 34px, which at a desktop band of roughly 1080px is a little over 3%. The
 * threshold is set well above that because the labels are positioned at the
 * *start* of their period, and periods here are wildly uneven: this archive has
 * two releases in January and seventeen in June, so a purely faithful axis puts
 * February and March nine pixels apart and then leaves half the band empty.
 */
const MIN_MARK_GAP = 0.06;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

type AxisMark = { index: number; label: string };

/**
 * The time axis, at whichever resolution the archive actually has.
 *
 * Years are the obvious unit and they are the wrong one for most of a project's
 * life: every release in this changelog is dated 2026, so a year axis is a
 * single label in the bottom-left corner saying nothing. It falls back to months
 * when the whole archive fits in one year, which is where the interesting shape
 * is anyway. Seven month marks across this band show the release cadence going
 * from one a month to seventeen, which is a fact about the project that the
 * columns alone cannot tell you.
 *
 * Crowded labels are dropped rather than shrunk or rotated. A mark exists to
 * say roughly where in time the reader is; four of them overlapping says less
 * than two of them legible.
 */
function axisMarks(columns: ReleasePulse[]): AxisMark[] {
  if (columns.length === 0) return [];

  const byYear =
    columns[0].date.slice(0, 4) !== columns.at(-1)?.date.slice(0, 4);

  const all: AxisMark[] = [];
  let previous = '';
  columns.forEach((entry, index) => {
    const period = byYear ? entry.date.slice(0, 4) : entry.date.slice(0, 7);
    if (period === previous) return;
    previous = period;
    all.push({
      index,
      label: byYear
        ? period
        : (MONTHS[Number(period.slice(5, 7)) - 1] ?? period),
    });
  });

  // The first mark is always kept: it is the left edge of the whole history,
  // and dropping it would leave the band starting at nothing.
  const kept: AxisMark[] = [];
  let lastKept = Number.NEGATIVE_INFINITY;
  for (const mark of all) {
    const position = mark.index / columns.length;
    if (kept.length === 0 || position - lastKept >= MIN_MARK_GAP) {
      kept.push(mark);
      lastKept = position;
    }
  }
  return kept;
}

type Props = {
  /** Newest first, as `getPulse()` returns it. Reversed here for drawing. */
  pulse: ReleasePulse[];
  activeAnchor: string | null;
  /**
   * Called before the browser follows the link. Returning `true` means the
   * navigation was handled here (the release had to be fetched first) and the
   * default should be prevented.
   */
  onSelect: (anchor: string) => boolean;
  variant?: 'full' | 'strip';
};

export function ReleaseSpectrum({
  pulse,
  activeAnchor,
  onSelect,
  variant = 'full',
}: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  // Time reads left to right. The archive is stored newest first because that
  // is the order it is read in, so the one reversal lives here.
  const columns = [...pulse].reverse();
  const max = Math.max(...columns.map((entry) => entry.total), 1);
  const strip = variant === 'strip';

  const marks = axisMarks(columns);
  const shown = hovered === null ? null : columns[hovered];

  return (
    <div
      className={cn('relative', strip ? 'py-1.5' : 'pt-1')}
      onPointerLeave={() => setHovered(null)}
    >
      {/*
        The readout. It replaces the bars' own labels rather than sitting beside
        them: at 26px a column has no room for a version number, and forty-one
        tooltips positioned individually is forty-one chances to overflow the
        frame. One readout in a fixed place also means the eye never has to
        chase it along the band.

        In the strip it is the left-hand label and shows wherever the reader is
        even when nothing is hovered, which is what makes the pinned bar answer
        "which release am I in" without being asked.
      */}
      {strip ? (
        <StripReadout
          entry={
            shown ?? columns.find((c) => c.anchor === activeAnchor) ?? null
          }
        />
      ) : (
        <FullReadout entry={shown} total={pulse.length} />
      )}

      <nav
        aria-label={strip ? undefined : 'Release history'}
        aria-hidden={strip || undefined}
        className={cn(
          'flex items-end',
          // The gap is a hairline on a phone and doubles from `sm`. Forty
          // columns of gap at 2px is eighty pixels, a quarter of a 330px band.
          // The separators would be as wide as the things they separate.
          strip ? 'h-[18px] gap-px' : 'h-24 gap-px sm:h-28 sm:gap-[2px]',
          // The columns stand on a rule rather than floating on the page. It is
          // the same hairline the rest of the frame is drawn with, and it is
          // what makes the band read as a figure with an axis instead of as a
          // row of shapes that happen to be bottom-aligned.
          !strip && 'border-b border-rule',
        )}
      >
        {columns.map((entry, index) => {
          const active = entry.anchor === activeAnchor;
          const isHovered = hovered === index;
          const height = MIN_HEIGHT + (1 - MIN_HEIGHT) * (entry.total / max);

          return (
            <a
              key={entry.anchor}
              href={`#${entry.anchor}`}
              // The strip redraws the nav above it. One tab stop per release is
              // plenty; two is a keyboard user walking the archive twice.
              tabIndex={strip ? -1 : undefined}
              onPointerEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              onClick={(event) => {
                if (onSelect(entry.anchor)) event.preventDefault();
              }}
              className={cn(
                'group/col relative flex h-full min-w-0 flex-1 flex-col justify-end outline-none',
                // The hit area is the full height of the band, not the height
                // of the column. A two-change patch is 17% tall and would
                // otherwise be a four-pixel target at the bottom of the frame.
                'before:absolute before:inset-x-0 before:inset-y-0 before:content-[""]',
              )}
            >
              <span
                style={{ height: `${height * 100}%` }}
                className={cn(
                  // A hairline between the bands, so a column reads as a stack
                  // of counts rather than one shape that changes colour twice.
                  'flex w-full flex-col gap-px overflow-hidden transition-[opacity,filter] duration-200',
                  strip ? 'rounded-[1px]' : 'rounded-t-[2px]',
                  // Dimming the rest is what makes one column readable in a row
                  // of forty-one. Nothing moves and nothing resizes: a band that
                  // reflows under the pointer cannot be aimed at.
                  hovered !== null && !isHovered && 'opacity-35',
                  active && 'ring-1 ring-primary/45 ring-offset-0',
                )}
              >
                {KIND_ORDER.map((kind) => {
                  const count = entry.counts[kind];
                  if (count === 0) return null;
                  return (
                    <span
                      key={kind}
                      style={{ flexGrow: count }}
                      className={cn('w-full', KIND_FILL[kind])}
                    />
                  );
                })}
              </span>

              {/* The marker for where the reader is. A cap above the column
                  rather than a colour change inside it, so it survives a
                  release whose bands are already lime. */}
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-0 -top-1 h-[3px] rounded-full bg-primary transition-opacity duration-200',
                  active ? 'opacity-100' : 'opacity-0',
                )}
              />

              <span className="sr-only">
                {entry.version}, {entry.title}, {formatReleaseDate(entry.date)},{' '}
                {entry.total} changes
              </span>
            </a>
          );
        })}
      </nav>

      {!strip && (
        <div aria-hidden className="relative mt-2.5 h-4">
          {marks.map((mark, index) => (
            <span
              key={mark.label}
              style={{ left: `${(mark.index / columns.length) * 100}%` }}
              className={cn(
                'absolute top-0 items-center gap-1.5 font-mono text-[10.5px] tabular-nums text-muted-foreground',
                // A phone gives the band about 330px, where the 6% minimum gap
                // is twenty pixels and a three-letter month is twenty-four. The
                // first mark still anchors the left edge; the rest wait for the
                // room to be legible in.
                index === 0 ? 'flex' : 'hidden sm:flex',
              )}
            >
              <span className="h-2 w-px bg-rule" />
              {mark.label}
            </span>
          ))}
          <span className="absolute right-0 top-0 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            Now
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * The header readout. Two lines held at a fixed height, because a block that
 * grows when the pointer enters the band pushes the band itself down by the
 * height of the thing that just appeared, and the column under the pointer is
 * then a different column.
 */
function FullReadout({
  entry,
  total,
}: {
  entry: ReleasePulse | null;
  total: number;
}) {
  return (
    <div className="mb-3 flex h-9 flex-wrap items-baseline gap-x-3 gap-y-1">
      {entry ? (
        <>
          <span className="font-mono text-[15px] font-medium tracking-tight text-foreground">
            {entry.version}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-muted-foreground">
            {entry.title}
          </span>
          <span className="flex shrink-0 items-center gap-2.5">
            {KIND_ORDER.slice()
              .reverse()
              .map((kind) =>
                entry.counts[kind] === 0 ? null : (
                  <span
                    key={kind}
                    className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className={cn('size-2 rounded-[1px]', KIND_CHIP[kind])}
                    />
                    {entry.counts[kind]}
                    <span className="sr-only">{KIND_LABEL[kind]}</span>
                  </span>
                ),
              )}
          </span>
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatReleaseDate(entry.date)}
          </span>
        </>
      ) : (
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {total} releases
          <span className="mx-2 text-rule">/</span>
          <span className="normal-case tracking-normal">
            hover the band to read one, click to jump
          </span>
        </span>
      )}
    </div>
  );
}

/** The pinned bar's label: whichever release is under the pointer, or failing
 *  that whichever one the reader is currently inside. */
function StripReadout({ entry }: { entry: ReleasePulse | null }) {
  return (
    <div className="mb-1.5 flex items-baseline gap-2.5 overflow-hidden">
      <span className="shrink-0 font-mono text-[12px] font-medium tracking-tight text-foreground">
        {entry?.version ?? '—'}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-muted-foreground">
        {entry?.title ?? 'Changelog'}
      </span>
    </div>
  );
}
