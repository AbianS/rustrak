import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.tsx'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  // Where the manager's brand mark is served from. It is a file rather than a
  // data URI so the wordmark stays the artwork and not a string nobody can
  // read; `public/rustrak-wordmark.svg` is generated from the same paths as
  // `components/brand/wordmark.tsx`.
  staticDirs: ['./public'],
  // Without this the stories render unstyled: Tailwind is what compiles the
  // tokens and the utilities, and the Storybook server does not ship it.
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
      /*
       * The docgen plugin's default is to read every `.tsx` in the project and
       * skip only `*.stories.tsx`, so it picks up `.storybook/preview.tsx` and
       * warns on every boot that the file is not in the TypeScript project.
       *
       * The warning is not worth chasing through tsconfig: there are no
       * components in `.storybook`. It is configuration, there is nothing in it
       * to document, and parsing it for props was wasted work before it was a
       * warning. The default is restated because giving `exclude` at all
       * replaces it.
       */
      exclude: ['**/*.stories.tsx', '.storybook/**'],
    },
  },
};

export default config;
