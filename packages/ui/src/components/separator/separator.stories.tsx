import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Separator } from './separator';

const meta = {
  title: 'Components/Separator',
  component: Separator,
  argTypes: {
    shape: { control: 'inline-radio', options: ['line', 'dot'] },
    orientation: {
      control: 'inline-radio',
      options: ['horizontal', 'vertical'],
    },
  },
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: (args) => (
    <div className="w-72">
      <Separator {...args} />
    </div>
  ),
};

/**
 * A vertical rule uses `self-stretch`, not `h-full`. In a flex row the parent
 * has no resolved height for a percentage to resolve against, so `h-full`
 * collapses to nothing and the rule silently disappears.
 */
export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: (args) => (
    <div className="flex items-center gap-3 text-meta text-fg-tertiary">
      <span>12,431 events</span>
      <Separator {...args} />
      <span>842 users</span>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const rule = canvasElement.querySelector('[role="none"]');
    await expect(rule).not.toBeNull();
    // The bug this guards: a rule with no height renders as nothing at all.
    await expect((rule as HTMLElement).clientHeight).toBeGreaterThan(0);
  },
};

/**
 * The dot form separates two pieces of meta on one line. At 3px it reads as
 * punctuation rather than as a bullet.
 */
export const MetaRow: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap items-center gap-2 text-meta text-fg-tertiary">
      <span className="font-mono text-code">web@2026.8.1</span>
      <Separator shape="dot" />
      <span>3 min ago</span>
      <Separator shape="dot" />
      <span>842 users affected</span>
    </div>
  ),
};

/**
 * Decorative by default. A rule that repeats what the layout already says is
 * noise in a screen reader, so it leaves the accessibility tree entirely.
 */
export const Decorative: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex w-72 flex-col gap-3">
      <Separator />
      <Separator decorative={false} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Exactly one is announced; the default one is not in the tree at all.
    await expect(canvas.getAllByRole('separator')).toHaveLength(1);
    await expect(canvasElement.querySelectorAll('[role="none"]')).toHaveLength(
      1,
    );
  },
};
