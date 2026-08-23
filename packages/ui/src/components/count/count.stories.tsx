import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Text } from '../text/text';
import { Count } from './count';

const meta = {
  title: 'Components/Count',
  component: Count,
  args: { children: '1.204' },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['default', 'muted', 'strong', 'brand'],
    },
  },
} satisfies Meta<typeof Count>;

export default meta;
type Story = StoryObj<typeof meta>;

const TONES = ['default', 'muted', 'strong', 'brand'] as const;

/** Every tone side by side: they differ by one step of contrast and nothing
    else, which is only checkable in one frame. */
export const States: Story = {
  parameters: { controls: { disable: true }, layout: 'padded' },
  render: () => (
    <div className="flex flex-col gap-2.5">
      {TONES.map((tone) => (
        <div key={tone} className="flex items-center gap-4">
          <span className="w-20 shrink-0 font-mono text-column text-fg-meta uppercase">
            {tone}
          </span>
          <Count tone={tone}>1.204</Count>
          <Count tone={tone}>12,4 K</Count>
          <Count tone={tone}>8</Count>
        </div>
      ))}
    </div>
  ),
};

/** Where it actually appears: trailing a label, never on its own. */
export const BesideALabel: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex items-center gap-2">
      <Text variant="control">Issues</Text>
      <Count>143</Count>
    </div>
  ),
};

/**
 * Zero is not rendered at all, so no caller has to remember to guard: an empty
 * count reads as "there are none", which is the state that deserves no ink.
 */
export const ZeroDrawsNothing: Story = {
  args: { children: 0 },
  render: (args) => (
    <div className="flex items-center gap-2">
      <Text variant="control">Muted</Text>
      <Count {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Muted')).toBeInTheDocument();
    await expect(canvas.queryByText('0')).not.toBeInTheDocument();
  },
};
