import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Text } from '../text/text';
import { Separator } from './separator';

const meta = {
  title: 'Components/Separator',
  component: Separator,
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['divider', 'default', 'strong'],
    },
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
    },
  },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

const TONES = ['divider', 'default', 'strong'] as const;

/**
 * Every tone in both orientations. The three are one step of contrast apart, so
 * the only way to tell that `divider` and `default` have not drifted into each
 * other is to put them in one frame.
 */
export const States: Story = {
  parameters: { controls: { disable: true }, layout: 'padded' },
  render: () => (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {TONES.map((tone) => (
          <div key={tone} className="flex flex-col gap-2">
            <Text variant="column" tone="meta">
              {tone}
            </Text>
            <Separator tone={tone} />
          </div>
        ))}
      </div>

      <div className="flex h-control-lg items-center gap-4">
        {TONES.map((tone) => (
          <div key={tone} className="flex h-full items-center gap-4">
            <Text variant="column" tone="meta">
              {tone}
            </Text>
            <Separator orientation="vertical" tone={tone} />
          </div>
        ))}
      </div>
    </div>
  ),
};

/** Between blocks on a panel, which is what `default` is for. */
export const BetweenBlocks: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex w-search flex-col gap-3 rounded-lg border border-border-subtle bg-panel p-4">
      <Text variant="card-title">Checkout API</Text>
      <Separator />
      <Text variant="meta" tone="meta">
        Last event 3 min ago
      </Text>
    </div>
  ),
};

/** It announces as a separator, which is what keeps it out of the reading
    order as content. */
export const ItAnnouncesAsASeparator: Story = {
  play: async ({ canvasElement }) => {
    const rule = within(canvasElement).getByRole('separator');

    await expect(rule).toHaveAttribute('aria-orientation', 'horizontal');
  },
};
