import { create } from 'storybook/theming';

/**
 * Storybook wearing the design system it documents.
 *
 * The values are the same ones in `src/styles/tokens.css`, written out as
 * literals because Storybook's manager is a separate bundle: it does not load
 * the preview's stylesheet, so it cannot read a CSS custom property. That is a
 * genuine duplication and the only one in the package — if a colour moves in
 * the tokens, it has to move here too, which is why every line below says which
 * token it is copying.
 *
 * The workshop is branded in lime rather than in the product's white wordmark.
 * It is a deliberate difference: this is the tool, not the application, and the
 * lime mark makes the tab findable in a row of twenty. One line to change if it
 * ever reads as the product.
 */
export const rustrakTheme = create({
  base: 'dark',

  brandTitle: 'Rustrak UI',
  brandUrl: 'https://github.com/rustrak/rustrak',
  brandImage: './rustrak-wordmark.svg',
  brandTarget: '_blank',

  // --surface-brand / --fg-accent
  colorPrimary: '#c5f11e',
  colorSecondary: '#c5f11e',

  // The four surfaces, in the order they stack: canvas, panel, surface.
  appBg: '#121212', // --surface-canvas
  appContentBg: '#161616', // --surface-panel
  appPreviewBg: '#121212', // --surface-canvas
  appBorderColor: '#2a2a2a', // --border
  appBorderRadius: 8, // --radius-lg
  /*
   * The row you are pointing at in the sidebar.
   *
   * It is the last of the five colours Storybook's dark theme sets by hand, and
   * the only one the documented shorthands do not reach -- `create()` takes it,
   * it is just not in the list anybody reads. Left alone it is `#233952`, a
   * navy tint of Storybook's own blue, so every hover in a lime sidebar flashed
   * blue. This is `--surface-hover`, the same tint the product puts under a nav
   * row.
   */
  appHoverBg: '#1e1e1e', // --surface-hover

  fontBase: '"Geist", ui-sans-serif, system-ui, sans-serif',
  fontCode: '"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace',

  textColor: '#fafafa', // --fg
  textInverseColor: '#121212', // --fg-inverse
  textMutedColor: '#888888', // --fg-subtle

  // The toolbar over the story: the same surface a topbar uses.
  barBg: '#1a1a1a', // --surface
  barTextColor: '#888888', // --fg-subtle
  barHoverColor: '#dddddd', // --fg-secondary
  barSelectedColor: '#c5f11e', // --fg-brand

  inputBg: '#1a1a1a', // --surface
  inputBorder: '#2a2a2a', // --border
  inputTextColor: '#fafafa', // --fg
  inputBorderRadius: 6, // --radius-md
});
