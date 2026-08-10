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
