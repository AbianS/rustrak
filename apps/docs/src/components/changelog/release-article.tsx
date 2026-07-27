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
}: {
  section: Release['sections'][number];
  index: number;
}) {
  return (
    <section className="mt-9 first:mt-8">
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
        className={cn('changelog-prose', section.title && 'mt-3.5 pl-[1.4rem]')}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: the only input is content/changelog/*.mdx, rendered by lib/changelog.ts at build time — nothing here is reachable from a request
        dangerouslySetInnerHTML={{ __html: section.html }}
      />
    </section>
  );
}

export function ReleaseArticle({ release }: { release: Release }) {
  return (
    <article
      id={release.anchor}
      className="border-b border-rule scroll-mt-[calc(var(--nextra-navbar-height,4rem)+1rem)]"
    >
      {/*
        The filename anchor, kept because it is what every link to this page
        published before today points at (`#41-v0-13-0-project-onboarding…`).
        The readable `#v0-13-0` is the one the page hands out now.
      */}
      <span
        id={release.slug}
        aria-hidden
        className="block scroll-mt-[calc(var(--nextra-navbar-height,4rem)+1rem)]"
      />

      {/*
        The same three tracks the blog uses — meta, body, aside — so the two
        sections of the site are one layout at one width rather than two pages
        that happen to share a palette.

        Below `lg` the tracks collapse and the order is set explicitly: the
        version strip first, then the tags, then the body. In a wide grid the
        tags belong beside the entry; stacked, they belong under its title,
        and `order` is what lets one piece of markup be in both places.
      */}
      <div className="flex flex-col px-5 pb-14 sm:px-9 sm:pb-16 lg:grid lg:grid-cols-[9.5rem_minmax(0,1fr)_12rem] lg:gap-x-10 lg:pt-14">
        {/*
          Pinned while the release is on screen. A long entry runs several
          screens deep, and without this the reader has to scroll back up to
          find out which version the fix they are reading actually landed in.

          Narrow, it is a bar across the top with a background to scroll under.
          Wide, it is a block in the left track and needs none of that chrome —
          it has a column of its own to sit in, so the rule, the tint and the
          blur all come off and only the pinning survives.
        */}
        <div className="sticky top-[var(--nextra-navbar-height,4rem)] z-10 -mx-5 flex items-center gap-2.5 border-b border-rule/70 bg-background/85 px-5 py-3 backdrop-blur sm:-mx-9 sm:px-9 lg:col-start-1 lg:row-start-1 lg:mx-0 lg:block lg:self-start lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none lg:top-[calc(var(--nextra-navbar-height,4rem)+3.5rem)]">
          <a
            href={`#${release.anchor}`}
            className="group/anchor font-mono text-[15px] font-medium tracking-tight text-foreground transition-colors hover:text-primary lg:block"
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
          <span className="lg:mt-2.5 lg:block">
            <ChannelChip channel={release.channel} />
          </span>
          <time
            dateTime={release.date}
            className="ml-auto font-mono text-[11.5px] tabular-nums text-muted-foreground lg:ml-0 lg:mt-3 lg:block"
          >
            {formatReleaseDate(release.date)}
          </time>
        </div>

        {release.tags.length > 0 && (
          <ul className="order-1 mt-5 flex flex-wrap items-center gap-x-2 gap-y-1.5 lg:order-none lg:col-start-3 lg:row-start-1 lg:mt-1 lg:flex-col lg:items-start lg:gap-1.5">
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

        <div className="order-2 lg:order-none lg:col-start-2 lg:row-start-1">
          <h2 className="pt-8 text-[1.6rem] font-medium leading-[1.15] tracking-[-0.025em] text-foreground sm:text-[1.9rem] lg:pt-0">
            {release.title}
          </h2>
          {release.description && (
            <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-muted-foreground">
              {release.description}
            </p>
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
                <Section
                  key={section.title || index}
                  section={section}
                  index={number}
                />
              );
            });
          })()}
        </div>
      </div>
    </article>
  );
}
