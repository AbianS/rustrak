import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Text } from '../text/text';
import { Kbd } from './kbd';

const meta = {
  title: 'Components/Kbd',
  component: Kbd,
  args: { children: '⌘K' },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['default', 'muted', 'on-brand'],
    },
  },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every tone at once. `on-brand` is drawn on lime because that is the only
 * surface it is ever used on, and against the canvas it would look broken
 * rather than wrong.
 */
export const States: Story = {
  parameters: { controls: { disable: true }, layout: 'padded' },
  render: () => (
    <div className="flex flex-col gap-3">
      {(['default', 'muted'] as const).map((tone) => (
        <div key={tone} className="flex items-center gap-4">
          <span className="w-20 shrink-0 font-mono text-column text-fg-meta uppercase">
            {tone}
          </span>
          <Kbd tone={tone}>⌘K</Kbd>
          <Kbd tone={tone}>Esc</Kbd>
          <Kbd tone={tone}>⏎</Kbd>
        </div>
      ))}
      <div className="flex items-center gap-4">
        <span className="w-20 shrink-0 font-mono text-column text-fg-meta uppercase">
          on-brand
        </span>
        <span className="flex items-center gap-3 rounded-md bg-surface-brand px-2.5 py-1">
          <Kbd tone="on-brand">⌘K</Kbd>
          <Kbd tone="on-brand">Esc</Kbd>
          <Kbd tone="on-brand">⏎</Kbd>
        </span>
      </div>
    </div>
  ),
};

/** Where it lives: at the end of the thing it triggers, never on its own. */
export const InsideASearchField: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex w-search items-center justify-between rounded-md border border-border-field bg-surface px-2.5 py-1.5">
      <Text variant="control" tone="placeholder">
        Search
      </Text>
      <Kbd>⌘K</Kbd>
    </div>
  ),
};

/** It is a `<kbd>`, so the shortcut is marked up as one and not as prose. */
export const ItIsMarkedUpAsAKey: Story = {
  play: async ({ canvasElement }) => {
    const key = within(canvasElement).getByText('⌘K');

    await expect(key.tagName).toBe('KBD');
  },
};
