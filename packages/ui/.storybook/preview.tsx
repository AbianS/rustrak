import { withThemeByDataAttribute } from '@storybook/addon-themes';
import type { Preview, ReactRenderer } from '@storybook/react-vite';
import './storybook.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/i },
      expanded: true,
    },
    a11y: {
      // An accessibility failure breaks the component test rather than
      // sitting in a warning nobody looks at.
      test: 'error',
      config: {
        rules: [
          // Contrast is checked in `src/styles/contrast.test.ts` instead, against
          // the rule that actually applies to this palette.
          //
          // Two of the supporting greys sit below AA on purpose: `--fg-subtle`
          // at 4.31:1 and `--fg-ghost` at 2.73:1 are the closed palette of
          // `Rustrak Rediseno v5`. Neither ever carries meaning alone. Left on,
          // this rule turns every story that uses them red and buries the
          // failures that do matter; the pinned ratios are what stops a palette
          // tweak from sliding past unnoticed.
          //
          // It is off for the palette, not for composition errors: the debug
          // badge shipped at 2.51:1 and that was fixed, not excused.
          { id: 'color-contrast', enabled: false },
        ],
      },
    },
    options: {
      storySort: { order: ['Fundamentos', 'Componentes'] },
    },
  },

  decorators: [
    withThemeByDataAttribute<ReactRenderer>({
      // There is only one theme. `Rustrak Rediseno v5` is a dark design and
      // defines no light one; when it exists it is added here and in
      // `styles/tokens.css`, and no component changes.
      themes: { dark: 'dark' },
      defaultTheme: 'dark',
      attributeName: 'data-theme',
    }),
  ],

  initialGlobals: {
    // Stories are reviewed on the same canvas as the application, which is not
    // pure black but #08080A.
    backgrounds: { value: 'canvas' },
  },
};

export default preview;
