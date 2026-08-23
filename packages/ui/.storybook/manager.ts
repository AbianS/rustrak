import { addons } from 'storybook/manager-api';
import { rustrakTheme } from './theme';

addons.setConfig({
  theme: rustrakTheme,
  // The sidebar is the table of contents for a design system, so it opens
  // showing the sections rather than every story in every one of them.
  sidebar: {
    showRoots: true,
    collapsedRoots: [],
  },
});
