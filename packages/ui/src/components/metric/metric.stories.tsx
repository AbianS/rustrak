import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { compareMetric } from './compare';
import { Metric } from './metric';

const meta = {
  title: 'Components/Metric',
  component: Metric,
  parameters: { layout: 'padded' },
  args: {
    label: 'Events',
    value: '12,403',
    comparison: { percent: 18, tone: 'negative' },
    comparisonLabel: 'vs previous',
  },
} satisfies Meta<typeof Metric>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every combination of direction and tone in one frame, and the point of the
 * frame is the second row: the same arrow, the opposite colour. Errors falling
 * and crash-free sessions falling are both down, and only one of them is good
 * news, so the arrow and the tone are drawn from two different facts.
 */
export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric
        comparison={compareMetric(12403, 10511, 'up-is-bad')}
        comparisonLabel="vs previous"
        label="Events"
        value="12,403"
      />
      <Metric
        comparison={compareMetric(41, 63, 'up-is-bad')}
        comparisonLabel="vs previous"
        label="New issues"
        value="41"
      />
      <Metric
        comparison={compareMetric(96.2, 99.1, 'up-is-good')}
        comparisonLabel="vs previous"
        label="Crash-free sessions"
        value="96.2 %"
      />
      <Metric
        caption="Nothing to compare against"
        label="Open issues"
        value="142"
      />
    </div>
  ),
};

/** A change of exactly zero draws no arrow: nothing moved, so nothing points. */
export const Unchanged: Story = {
  args: {
    comparison: compareMetric(500, 500, 'up-is-bad'),
    label: 'Events',
    value: '500',
  },
};

/**
 * `compareMetric` returns nothing when there is no earlier window, and nothing
 * again when that window was zero. Neither is a 100 % rise, which is what naive
 * arithmetic prints for both.
 */
export const NothingToCompare: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="grid gap-3 sm:grid-cols-2">
      <Metric
        caption="All time, so there is no window before it"
        comparison={compareMetric(900, null, 'up-is-bad')}
        label="Events"
        value="900"
      />
      <Metric
        caption="The previous window was empty"
        comparison={compareMetric(900, 0, 'up-is-bad')}
        label="Events"
        value="900"
      />
    </div>
  ),
};

/**
 * With `render` it becomes a link, and the whole tile is the target. Tabbing to
 * it reaches one control, not a figure with a link hidden inside it.
 */
export const AsALink: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <Metric label="Open issues" render={<a href="#issues" />} value="142" />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const link = canvas.getByRole('link', { name: /Open issues/ });

    await userEvent.tab();
    await expect(link).toHaveFocus();
  },
};
