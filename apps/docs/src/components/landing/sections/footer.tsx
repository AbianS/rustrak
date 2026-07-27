import Link from 'next/link';
import { RustrakLogoIcon } from '@/components/icons/rustrak-logo';
import { GITHUB } from '../links';

const SPONSOR_URL = 'https://github.com/sponsors/AbianS';

/**
 * Four columns, because four divides into two and into four.
 *
 * The rules between these cells are drawn only where a cell has a neighbour, so
 * the grid closes flush against the frame instead of doubling its lines — and
 * that only stays true if the count fits both layouts without an orphan. It is
 * the same arithmetic the SDK strip and the footprint numbers depend on, and it
 * is the reason the outbound links are a fourth group rather than a stray pair
 * dropped under the third.
 */
const COLUMNS = [
  {
    title: 'Docs',
    links: [
      { href: '/getting-started/overview', label: 'Overview' },
      { href: '/getting-started/installation', label: 'Installation' },
      { href: '/getting-started/quickstart', label: 'Quickstart' },
      { href: '/api-reference', label: 'API reference' },
    ],
  },
  {
    title: 'Configuration',
    links: [
      { href: '/configuration/environment', label: 'Environment' },
      { href: '/configuration/database', label: 'Database' },
      { href: '/configuration/production', label: 'Production' },
    ],
  },
  {
    title: 'Project',
    links: [
      { href: '/changelog', label: 'Changelog' },
      { href: '/blog', label: 'Blog' },
      { href: GITHUB, label: 'GitHub' },
    ],
  },
  /*
    Named for what a reader wants from it, not for what they can give.

    It was "Support" over `Sponsor` and `Contributing`, which are both ways of
    supporting the project rather than ways of being supported by it. Somebody
    arriving at that heading with a broken deploy found two invitations to help
    and no way to ask for any.

    `Issues` is the link that fixes it, and it was missing from the whole footer.
    Discussions is deliberately absent: it is switched off on the repository, so
    there is nowhere for it to point.
  */
  {
    title: 'Community',
    links: [
      { href: `${GITHUB}/issues`, label: 'Issues' },
      { href: '/reference/contributing', label: 'Contributing' },
      { href: SPONSOR_URL, label: 'Sponsor' },
    ],
  },
] as const;

/**
 * The footer, uncovered by the page sliding over it.
 *
 * ── Why there is no giant wordmark ──────────────────────────────────────────
 *
 * There was one: `RUSTRAK` set at 320px, bled to the frame's two rules, sized
 * off the font's own advance widths so it landed within 0.2% of them at every
 * viewport. It was precise and it was wrong, and the argument against it was
 * already written down in `globals.css`, one scroll above the display scale:
 *
 *   "Deliberately restrained: the reference this page follows tops out around
 *    72px on desktop and lets the ruled grid and the white space carry the
 *    composition. Poster-sized type was doing that job before and it fought the
 *    product screens for attention."
 *
 * A 320px word is four and a half times the largest type anywhere else here. It
 * does not read as the page's masthead, it reads as a different page's, and it
 * arrives at the exact moment this one is meant to be handing over quietly. It
 * also cost 230px of height on its own, which is most of what a footer should
 * measure in total.
 *
 * So the mark is the one the nav already uses, at the size the nav already uses
 * it, and the composition is carried by the same thing that carries every other
 * band: ruled cells with mono labels over them.
 *
 * ── No rule along the top ───────────────────────────────────────────────────
 *
 * Not an omission. The closing band is a `Band` and already closes against its
 * own bottom hairline, so a second one here would double it to 2px where the
 * two meet at rest. It is also the right edge to leave in the closing's hands:
 * during the reveal that hairline is the moving edge, the lid's bottom sweeping
 * up the screen, and this footer has no edge of its own until it is uncovered.
 *
 * ── The reveal ──────────────────────────────────────────────────────────────
 *
 * The same idea as the lid over the manifesto's painting, by a different
 * mechanism, and the difference is why this is not a `<Pinned>`.
 *
 * `Pinned` sticks its band to the *top* of the viewport, which is why its
 * overlap has to be exactly one screen: a top-stuck band is only stationary
 * once its top has reached the top of the screen, so anything less leaves a
 * stretch where the band has been uncovered but is still travelling, and that
 * reads as a lurch. The band therefore has to *be* a screen tall. Right for one
 * sentence over a fresco; wrong for a footer, which would mean ending the page
 * on a full viewport with a few links floating in it.
 *
 * Sticking to the *bottom* removes the constraint rather than working around
 * it. The footer is whatever height its contents make it, `bottom: 0` holds it
 * against the bottom of the screen, and the closing band above — opaque and on
 * a higher layer, see `Cover` in `landing-page.tsx` — covers it until it does
 * not. The arithmetic falls out: scroll back up by δ and the closing's bottom
 * edge sits δ lower, so exactly δ less of the footer shows. The reveal runs for
 * precisely the footer's own height and the page grows by precisely the
 * footer's own height. There is no corridor because there is nothing to pad.
 *
 * ── Why it cannot get this wrong ────────────────────────────────────────────
 *
 * A sticky element is clamped by its containing block, and that block here is
 * the box holding the closing band *and* this footer, so the footer physically
 * cannot be pulled above the closing's top edge. If a window is ever short
 * enough that the footer is taller than the band covering it, the browser ends
 * the reveal early rather than letting the links surface over the section
 * above. No height is reserved and no two numbers have to be kept in agreement.
 *
 * ── Not on a phone ──────────────────────────────────────────────────────────
 *
 * Below `sm` this is an ordinary block at the end of the document. Uncovering a
 * footer is something you notice while steering a scroll with a wheel; with a
 * thumb it mostly reads as a footer that lags. It is the same call the hero
 * makes below `lg` and the engine makes for its whole stage.
 */
export function SiteFooter() {
  return (
    <footer className="sm:sticky sm:bottom-0">
      {/*
        Two up on a phone, four across from `lg`, and the rules are drawn only
        where a cell has a neighbour. Each case is spelled out as a literal
        class: Tailwind scans source text, so a class name assembled from a
        variable prefix is never generated. This is the footprint strip's
        pattern exactly, because it is the same shape of problem.
      */}
      <ul className="grid grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map((column, index) => (
          <li
            key={column.title}
            className={[
              'border-rule px-5 py-8 sm:px-10 sm:py-10',
              index === 1 ? 'lg:border-r' : index === 3 ? '' : 'border-r',
              index < 2 ? 'border-b lg:border-b-0' : '',
            ].join(' ')}
          >
            <p className="eyebrow">{column.title}</p>
            <ul className="mt-4">
              {column.links.map((link) => (
                <li key={link.href}>
                  {/* `block` with vertical padding rather than a bare inline
                      link: at 13.5px the hit area was a third of the 44px a
                      thumb needs, and these sit close enough together to make
                      that a real miss. */}
                  <Link
                    href={link.href}
                    className="block py-1.5 text-[13.5px] text-white/55 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      {/*
        The strip, kept exactly as it was, with the mark moved into it.

        It is the only place a wordmark belongs in this footer. The lockup is
        the nav's, at the nav's size and tracking, so the page opens and closes
        on the same mark rather than on two different treatments of it — and
        putting it at the head of the licence line means it costs no height at
        all: the row was already there and its left edge was doing nothing.
      */}
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-rule px-5 py-6 text-[12.5px] text-white/35 sm:gap-3 sm:px-10">
        <p className="flex items-center gap-2.5">
          <RustrakLogoIcon className="size-4" />
          <span>Rustrak · GPL-3.0</span>
        </p>
        <p>Not affiliated with Sentry. Compatible with its SDKs.</p>
      </div>
    </footer>
  );
}
