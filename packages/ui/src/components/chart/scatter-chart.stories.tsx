import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ScatterChart, type ScatterPoint } from './scatter-chart';

const ROUTES: ScatterPoint[] = [
  { id: '1', name: 'POST /api/checkout', x: 491, y: 2010, tone: 'warning' },
  {
    id: '2',
    name: 'POST /api/payments/authorize',
    x: 586,
    y: 3570,
    tone: 'danger',
  },
  { id: '3', name: 'GET /api/cart', x: 4820, y: 96 },
  { id: '4', name: 'GET /api/products/:id', x: 9140, y: 62 },
  { id: '5', name: 'POST /api/orders', x: 523, y: 1230, tone: 'warning' },
  { id: '6', name: 'GET /api/shipping/quote', x: 525, y: 796 },
  { id: '7', name: 'checkout.reconcile', x: 12, y: 6650, tone: 'warning' },
];

const meta = {
  title: 'Charts/ScatterChart',
  component: ScatterChart,
  parameters: { layout: 'padded' },
  args: {
    points: ROUTES,
    height: 280,
    xCaption: 'Calls',
    yCaption: 'p95',
    label: 'Latency against volume',
    formatY: (value: number) =>
      value < 1000
        ? `${Math.round(value)} ms`
        : `${(value / 1000).toFixed(1)} s`,
  },
} satisfies Meta<typeof ScatterChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The reading the component exists for. `checkout.reconcile` is the slowest
 * thing on the chart and it sits alone on the left, called twelve times: a
 * ranked list would have put it first and buried the payment call that is
 * both slow and busy.
 */
export const LatencyAgainstVolume: Story = {};

/** Every tone in one frame, so a drifted fill shows up as a mismatch. */
export const States: Story = {
  args: {
    points: [
      { id: 'n', name: 'neutral', x: 100, y: 200 },
      { id: 'b', name: 'brand', x: 300, y: 400, tone: 'brand' },
      { id: 'w', name: 'warning', x: 500, y: 600, tone: 'warning' },
      { id: 'd', name: 'danger', x: 700, y: 800, tone: 'danger' },
    ],
    label: 'Every tone',
  },
};

/** One point is a scale of one. It still draws, and the axes still say what they are. */
export const SinglePoint: Story = {
  args: {
    points: [{ id: '1', name: 'GET /api/health', x: 92_000, y: 4 }],
    label: 'One route',
  },
};

/** The figure is named for anyone who cannot see it, and the dots stay explorable. */
export const ItNamesTheFigure: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByLabelText('Latency against volume'),
    ).toBeInTheDocument();
  },
};
