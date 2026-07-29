import {
  formatReleaseDate,
  type Release,
  type ReleaseChannel,
  type SectionKind,
} from '@/lib/release';
import { cn } from '@/lib/utils';

/**
 * One release, as a short document.
 *
 * The hierarchy is the whole point of this file, so it is worth stating: a
 * reader landing here is answering one of two questions, "what shipped lately"
 * or "what changed in the version I am about to upgrade to", and both are
 * answered by scanning, never by reading top to bottom. So every level is
 * given a different *kind* of mark rather than a different size of the same
 * one — the version is monospaced, the title is display type, a section is a
 * numbered rule, and the body is prose. Two levels that differ only in font
 * size collapse into one the moment the page is scrolled quickly.
 *
 * ── What the redesign changed, and why ─────────────────────────────────────
 *
 * The body used to fill its whole track. In the widest layout that came to
 * around 95 characters a line, set at 14.5px in `--muted-foreground`. Three
 * separate reasons for the same complaint, which was that the page was hard to
 * read on a large monitor. All three are fixed below and in `globals.css`: the
 * column is capped at a measure, the type went up a step, and the body is no
 * longer painted in the colour reserved for metadata.
 *
 * The right-hand track used to hold the tags, which meant eleven rems of a wide
 * screen were spent on two words. It holds the release's section index now, and
 * the tags moved to the left rail where the rest of the metadata already was.
 */

const CHANNEL_LABEL: Record<ReleaseChannel, string> = {
  minor: 'Minor',
  patch: 'Patch',
  seed: 'Early',
};

/**
 * Only a minor is tinted. Patches outnumber minors roughly two to one, and a
 * changelog where every entry carries a coloured badge has no emphasis left to
 * spend on the releases that actually add something.
 */
const CHANNEL_STYLE: Record<ReleaseChannel, string> = {
  minor: 'border-primary/30 bg-primary/10 text-primary',
  patch: 'border-rule text-muted-foreground',
  seed: 'border-rule text-muted-foreground',
};

const KIND_TICK: Record<SectionKind, string> = {
  shipped: 'bg-primary',
  improved: 'bg-foreground/25',
  fixed: 'bg-amber-500/70',
  documented: 'bg-foreground/25',
};

/**
 * How far below the top of the viewport an anchored element should land.
 *
 * It is the pinned strip's height and *not* the navbar's, which is the part
 * that is easy to get wrong. This file did, and every jump overshot by 64px.
 * Nextra already sets `scroll-padding-top: var(--nextra-navbar-height)` on
 * `html`, and `scroll-padding` on the scroll container adds to `scroll-margin`
 * on the target rather than replacing it. Counting the navbar here counted it
 * twice, and a release landed a whole navbar below the bar it was supposed to
 * sit under, far enough that the reading line was still inside the *previous*
 * release and the strip named that one instead.
 *
 * So this covers only what Nextra does not know about, which is the strip.
 */
const ANCHOR_OFFSET = 'scroll-mt-[3.5rem]';

/**
 * A section's own anchor, namespaced by its release. Section titles repeat
 * across the archive (a dozen entries have an "Improvements"), so the release
 * anchor has to be part of it or the index in one entry would jump to another.
 */
function sectionId(anchor: string, title: string): string {
  return `${anchor}--${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function ChannelChip({ channel }: { channel: ReleaseChannel }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em]',
        CHANNEL_STYLE[channel],
      )}
    >
      {CHANNEL_LABEL[channel]}
    </span>
  );
}

function Section({
  section,
  index,
  anchor,
}: {
  section: Release['sections'][number];
  index: number;
  anchor: string;
}) {
  return (
    <section
      id={section.title ? sectionId(anchor, section.title) : undefined}
      className={cn('mt-10 scroll-mt-[4.5rem] first:mt-8')}
    >
      {section.title && (
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn('h-3.5 w-0.5 shrink-0', KIND_TICK[section.kind])}
          />
          <span
            aria-hidden
            className="font-mono text-[11px] tabular-nums text-muted-foreground/70"
          >
            {String(index).padStart(2, '0')}
          </span>
          <h3 className="font-mono text-[11.5px] font-medium uppercase tracking-[0.13em] text-foreground">
            {section.title}
          </h3>
          {/* The rule runs to the edge of the column, which is what makes a
              stack of sections read as one ruled document rather than as a
              list of bold lines. */}
          <span aria-hidden className="h-px min-w-6 flex-1 bg-rule" />
        </div>
      )}
      <div
        className={cn('changelog-prose', section.title && 'mt-4 pl-[1.4rem]')}
        /* The HTML is this repo's own changelog MDX, parsed by `marked` at
           build time. Nothing user-supplied reaches it: the only inputs are
           files in content/changelog/, which are as trusted as the code. */
        // react-doctor-disable-next-line react-doctor/dangerous-html-sink
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the only input is content/changelog/*.mdx, rendered by lib/changelog.ts at build time — nothing here is reachable from a request
        dangerouslySetInnerHTML={{ __html: section.html }}
      />
    </section>
  );
}

export function ReleaseArticle({ release }: { release: Release }) {
  const titled = release.sections.filter((section) => section.title);

  return (
    <article
      id={release.anchor}
      // Read by the feed's observer to work out which release the reader is
      // inside, which is what lights a column in the spectrum.
      data-release={release.anchor}
      className={cn('border-b border-rule', ANCHOR_OFFSET)}
    >
      {/*
        The filename anchor, kept because it is what every link to this page
        published before today points at (`#41-v0-13-0-project-onboarding…`).
        The readable `#v0-13-0` is the one the page hands out now.
      */}
      <span
        id={release.slug}
        aria-hidden
        className={cn('block', ANCHOR_OFFSET)}
      />

      {/*
        Three tracks: metadata, the document, its index.

        The middle one is capped at a measure rather than filling the space
        between the other two. See the header note. The consequence worth
        naming is that the frame can now be as wide as the composition wants
        without the prose getting any harder to read, which is what makes the
        spectrum above it possible at all.

        Below `lg` the tracks collapse into ordinary blocks and the index is
        dropped: on a phone it would be a list of four links directly above the
        four things they link to.
      */}
      <div className="px-5 pb-14 pt-9 sm:px-9 sm:pb-16 lg:grid lg:grid-cols-[9.5rem_minmax(0,1fr)] lg:gap-x-10 lg:pt-12 xl:grid-cols-[9.5rem_minmax(0,1fr)_11rem]">
        {/*
          Left rail. It no longer pins: the spectrum's strip is pinned across
          the top of the page and already names the release the reader is in,
          and two sticky version labels a few pixels apart is one too many.
        */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 lg:col-start-1 lg:row-start-1 lg:block lg:self-start">
          <a
            href={`#${release.anchor}`}
            className="group/anchor font-mono text-[17px] font-medium tracking-tight text-foreground transition-colors hover:text-primary lg:block"
          >
            {release.version}
            <span
              aria-hidden
              className="ml-1.5 text-muted-foreground opacity-0 transition-opacity group-hover/anchor:opacity-100"
            >
              #
            </span>
            <span className="sr-only">Permalink to {release.version}</span>
          </a>

          <span className="lg:mt-3 lg:block">
            <ChannelChip channel={release.channel} />
          </span>

          <time
            dateTime={release.date}
            className="font-mono text-[11.5px] tabular-nums text-muted-foreground lg:mt-3 lg:block"
          >
            {formatReleaseDate(release.date)}
          </time>

          {release.tags.length > 0 && (
            <ul className="flex w-full flex-wrap items-center gap-1.5 lg:mt-5 lg:w-auto">
              {release.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-sm bg-foreground/[0.055] px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
                >
                  {tag}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="lg:col-start-2 lg:row-start-1">
          <div className="max-w-[40rem]">
            <h2 className="mt-7 text-[1.55rem] font-medium leading-[1.2] tracking-[-0.022em] text-foreground sm:text-[1.75rem] lg:mt-0">
              {release.title}
            </h2>
            {release.description && (
              <p className="changelog-lead mt-3.5">{release.description}</p>
            )}

            {/*
              Numbered across the titled sections only. A file that opens with a
              paragraph produces an untitled lead section, and counting it would
              make every entry that has one start at 02.
            */}
            {(() => {
              let number = 0;
              return release.sections.map((section, index) => {
                if (section.title) number += 1;
                return (
                  // react-doctor-disable-next-line react-doctor/no-array-index-as-key
                  <Section
                    // The title is the key wherever there is one. The index is
                    // reached only by the untitled lead section, of which a
                    // release has at most one, in a list parsed once from static
                    // MDX and never reordered.
                    key={section.title || index}
                    section={section}
                    index={number}
                    anchor={release.anchor}
                  />
                );
              });
            })()}
          </div>
        </div>

        {/*
          The index, and the reason the third track earns its width now. Two
          sections is the threshold: below it the index would be a link to the
          only heading in the entry, sitting level with that heading.

          It pins, unlike the left rail, because that is the difference between
          a list of contents and a way of moving around: a five-section release
          runs past three screens and the index has to still be there on the
          third.
        */}
        {titled.length > 1 && (
          <nav
            aria-label={`Sections of ${release.version}`}
            className="hidden xl:col-start-3 xl:row-start-1 xl:block xl:self-start xl:sticky xl:top-[calc(var(--nextra-navbar-height,4rem)+4.5rem)]"
          >
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
              In this release
            </p>
            <ul className="mt-3.5 flex flex-col gap-2 border-l border-rule pl-3.5">
              {titled.map((section, index) => (
                <li key={section.title}>
                  <a
                    href={`#${sectionId(release.anchor, section.title)}`}
                    className="group/sec flex gap-2 text-[12px] leading-snug text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span className="font-mono tabular-nums text-muted-foreground/60">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">{section.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </article>
  );
}
