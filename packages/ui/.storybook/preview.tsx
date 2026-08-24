import { withThemeByDataAttribute } from '@storybook/addon-themes';
import type { Preview, ReactRenderer } from '@storybook/react-vite';
import { rustrakTheme } from './theme';
import './storybook.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
      expanded: true,
    },
    /*
     * The backgrounds are declared as the tokens themselves, not as the hexes
     * behind them.
     *
     * The addon writes its value straight onto the preview body, so a literal
     * `#121212` pins the canvas to the dark value and switching the theme in
     * the toolbar changes the components while the page around them stays
     * black. Handing it `var(--surface-canvas)` makes it resolve against
     * whatever `data-theme` is currently on the document, so the two toolbar
     * controls stop contradicting each other.
     */
    backgrounds: {
      options: {
        canvas: { name: 'canvas', value: 'var(--surface-canvas)' },
        panel: { name: 'panel', value: 'var(--surface-panel)' },
        surface: { name: 'surface', value: 'var(--surface)' },
      },
    },
    docs: {
      // The documentation pages wear the same theme as the manager around them.
      theme: rustrakTheme,
      /*
       * No table of contents.
       *
       * The pages carry their own numbered sections, and a second list of the
       * same headings pinned to the right takes a third of the width to repeat
       * what the page already says on the way down.
       */
      toc: false,
    },
    a11y: {
      // A failing accessibility check breaks the component test; it does not
      // sit in a tab that nobody opens.
      test: 'error',
      config: {
        rules: [
          // Contrast is checked in `styles/contrast.test.ts` against the ratio
          // that actually applies to this palette, with the supporting greys
          // documented one by one. Leaving it on here would paint every story
          // red for the same known reason and bury the failures that matter.
          { id: 'color-contrast', enabled: false },
          // Flags the focus guards Base UI injects into its portals. They are
          // its own and they are correct: without them focus escapes the popup.
          { id: 'aria-hidden-focus', enabled: false },
        ],
      },
    },
    options: {
      storySort: {
        order: [
          'Overview',
          'Foundations',
          ['Colour', 'Typography', 'Space', 'Motion', 'Icons', 'Accessibility'],
          'Components',
          'Charts',
          'Shell',
        ],
      },
    },
  },

  decorators: [
    withThemeByDataAttribute<ReactRenderer>({
      themes: { dark: 'dark', light: 'light' },
      defaultTheme: 'dark',
      attributeName: 'data-theme',
    }),
  ],

  initialGlobals: {
    // Rustrak is a dark product: stories are looked at on the same canvas the
    // application uses, never on white.
    backgrounds: { value: 'canvas' },
  },
};

export default preview;
