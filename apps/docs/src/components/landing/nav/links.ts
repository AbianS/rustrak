/**
 * The bar's destinations, shared by the bar and the phone menu.
 *
 * One list rather than two: the menu is the bar at a narrow width, and a
 * reader who found a link on a desktop and went looking for it on a phone
 * should find the same one.
 */
export const LINKS = [
  { href: '/getting-started/overview', label: 'Docs' },
  { href: '/changelog', label: 'Changelog' },
  { href: '/blog', label: 'Blog' },
] as const;

export const REPO = 'https://github.com/AbianS/rustrak';
