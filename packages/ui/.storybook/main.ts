import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
  // No `*.mdx` while none exists: an empty glob makes every test run start
  // with a warning, and a warning that is always there is one nobody reads.
  // It goes back in with the first docs page.
  stories: ['../src/**/*.stories.tsx'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@storybook/addon-vitest',
  ],
  framework: { name: '@storybook/react-vite', options: {} },
  // Without this the stories render unstyled: Tailwind is what compiles the
  // tokens and utilities, and Storybook's server does not ship it.
  viteFinal: async (config) => {
    config.plugins = [...(config.plugins ?? []), tailwindcss()];
    return config;
  },
  typescript: {
    // Controls and the props table come from the real types, not from a
    // hand-written list that goes stale.
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) => !prop.parent?.fileName.includes('node_modules'),
    },
  },
};

export default config;
