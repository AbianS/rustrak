import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Text } from '../text/text';
import { Sparkline } from './sparkline';

function seed(count: number, low: number, high: number, start: number) {
  const out: number[] = [];
  let x = start;
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280;
    out.push(low + (x / 233280) * (high - low));
  }
  return out;
}

const meta = {
  title: 'Charts/Sparkline',
  component: Sparkline,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The three tones: state, not decoration. */
export const Tones: Story = {
  args: { values: [], label: '' },
  render: () => (
    <div className="flex flex-col gap-3">
      {(
        [
          ['danger', 'getting worse', seed(14, 2, 14, 11)],
          ['warning', 'on its way there', seed(14, 1, 11, 19)],
          ['brand', 'being watched', seed(14, 1, 9, 41)],
          ['neutral', 'everything else', seed(14, 1, 8, 27)],
        ] as const
      ).map(([tone, hint, values]) => (
        <div key={tone} className="flex items-center gap-4">
          <Sparkline
            values={[...values]}
            tone={tone}
            label={`Events, last 14 days (${tone})`}
          />
          <Text variant="meta" tone="subtle">
            {tone} — {hint}
          </Text>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const spark = canvas.getByRole('img', {
      name: 'Events, last 14 days (danger)',
    });
    await expect(spark).toBeInTheDocument();
    // One bar per bucket, zeros included: a vanished bucket reads as a hole.
    await expect(spark.querySelectorAll('rect').length).toBe(14);
  },
};

/** Where it lives: a table cell, dozens per page, none of them animated. */
export const InAList: Story = {
  args: { values: [], label: '' },
  render: () => (
    <div className="w-120 rounded-xl border border-border-subtle bg-panel">
      {(
        [
          ['ConnectionTimeout: pool exhausted', 'danger', 11],
          ['ValidationError: coupon not applicable', 'neutral', 27],
          ['DeprecationWarning: legacy shipping API', 'neutral', 63],
        ] as const
      ).map(([title, tone, s]) => (
        <div
          key={title}
          className="flex items-center gap-4 border-border-divider border-b px-4 py-3 last:border-0"
        >
          <Text variant="value" truncate className="flex-1">
            {title}
          </Text>
          <Sparkline
            values={seed(14, 1, 12, s)}
            tone={tone}
            label="Events, last 14 days"
          />
        </div>
      ))}
    </div>
  ),
};
