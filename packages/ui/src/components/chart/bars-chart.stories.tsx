import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, waitFor, within } from 'storybook/test';
import { Text } from '../text/text';
import { BarsChart } from './bars-chart';

function seed(count: number, low: number, high: number, start: number) {
  const out: number[] = [];
  let x = start;
  for (let i = 0; i < count; i++) {
    x = (x * 9301 + 49297) % 233280;
    out.push(Math.round(low + (x / 233280) * (high - low)));
  }
  return out;
}

const errors = seed(28, 120, 900, 5);
const warnings = seed(28, 40, 360, 17);
const info = seed(28, 20, 220, 29);

const DATA = Array.from({ length: 28 }, (_, i) => ({
  day: i + 1,
  error: errors[i] ?? 0,
  warning: warnings[i] ?? 0,
  info: info[i] ?? 0,
}));

/*
 * Severity is a status, not an entity: its colours are the reserved
 * severity tokens, never dealt from the categorical order.
 */
const SEVERITY_SERIES = [
  { key: 'info', label: 'Info', color: 'var(--sev-info)' },
  { key: 'warning', label: 'Warning', color: 'var(--sev-warning)' },
  { key: 'error', label: 'Error', color: 'var(--sev-error)' },
];

const meta = {
  title: 'Charts/Bars',
  component: BarsChart,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BarsChart>;

export default meta;
type Story = StoryObj;

/** The events-by-severity column of the overview screen. */
export const BySeverity: Story = {
  render: () => (
    <div className="w-160 rounded-xl border border-border-subtle bg-surface p-4">
      <Text variant="card-title" render={<h3 />} className="pb-3">
        Events by severity, 28 days
      </Text>
      <BarsChart
        data={DATA}
        series={SEVERITY_SERIES}
        xKey="day"
        height={180}
        formatX={(value) => `d${value}`}
        formatY={(value) =>
          value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
        }
        label="Events per day by severity, last 28 days"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('.recharts-bar').length,
      ).toBeGreaterThan(0),
    );
    // Status series still get their legend: colour is never the only name.
    await expect(canvas.getByText('Error')).toBeInTheDocument();
    await expect(canvas.getByText('Warning')).toBeInTheDocument();

    // The pointer asks for the numbers: the tooltip is the reading layer.
    const surface = canvasElement.querySelector('.recharts-wrapper');
    if (surface) {
      const box = surface.getBoundingClientRect();
      fireEvent.mouseMove(surface, {
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
      });
      await waitFor(() =>
        expect(
          canvas.getAllByText(/Error|Warning|Info/).length,
        ).toBeGreaterThan(3),
      );
    }
  },
};

/** One series, no stack: a log volume. */
export const SingleSeries: Story = {
  render: () => (
    <div className="w-160 rounded-xl border border-border-subtle bg-surface p-4">
      <Text variant="card-title" render={<h3 />} className="pb-3">
        Log volume, 28 days
      </Text>
      <BarsChart
        data={DATA}
        series={[{ key: 'info', label: 'Entries' }]}
        xKey="day"
        height={140}
        stacked={false}
        formatX={(value) => `d${value}`}
        label="Log entries per day, last 28 days"
      />
    </div>
  ),
};
