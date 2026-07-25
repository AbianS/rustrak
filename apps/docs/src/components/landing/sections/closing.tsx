import Link from 'next/link';
import { GithubIcon } from '@/components/icons/github';
import { GITHUB } from '../links';
import { Band } from '../primitives/grid';
import { Heading } from '../primitives/heading';

const FOOTER_LINKS = [
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
] as const;

export function Closing() {
  return (
    <>
      <Band>
        <div className="px-5 py-20 text-center sm:px-10 sm:py-32">
          <Heading
            className="display-lg mx-auto max-w-[20ch]"
            lead="Stop renting your stack traces."
            rest="Sentry-compatible, self-hosted, GPL-3.0, and yours to run."
            scrub
          />

          {/* Stacked and full width on a phone, as in the hero — the same two
              actions, so they get the same shape. */}
          <div className="mx-auto mt-9 flex max-w-xs flex-col items-stretch gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
            <Link
              href="/getting-started/quickstart"
              className="rounded-lg bg-primary px-4 py-3 text-center text-[15px] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:py-2.5 sm:text-[14px]"
            >
              Get started
            </Link>
            <a
              href={GITHUB}
              /* Matched to the hero's pair rather than left as a bare outline.
                 This one sits on a plain band and was legible either way, but
                 the two are the same two actions and the comment above says they
                 get the same shape — that has to include the surface. */
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/18 bg-white/6 px-4 py-3 text-[15px] font-medium text-white/90 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white sm:py-2.5 sm:text-[14px]"
            >
              <GithubIcon className="size-4" />
              Star on GitHub
            </a>
          </div>
        </div>
      </Band>

      <footer>
        {/* Two columns on a phone, three from `sm`. One column would run the
            footer to most of a screen for ten links. */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-9 px-5 py-12 sm:grid-cols-3 sm:gap-10 sm:px-10 sm:py-14">
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-white/30">
                {group.title}
              </p>
              <ul className="mt-3 sm:mt-4">
                {group.links.map((link) => (
                  <li key={link.href}>
                    {/* `block` with vertical padding rather than a bare inline
                        link: at 13.5px the hit area was a third of the 44px a
                        thumb needs, and these sit close enough together to
                        make that a real miss. */}
                    <Link
                      href={link.href}
                      className="block py-1.5 text-[13.5px] text-white/55 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-rule px-5 py-6 text-[12.5px] text-white/35 sm:gap-3 sm:px-10">
          <p>Rustrak · GPL-3.0</p>
          <p>Not affiliated with Sentry. Compatible with its SDKs.</p>
        </div>
      </footer>
    </>
  );
}
