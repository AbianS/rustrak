import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { SeverityDot } from './severity-dot';

const meta = {
  title: 'Components/SeverityDot',
  component: SeverityDot,
  args: { level: 'error' },
  argTypes: {
    level: {
      control: 'inline-radio',
      options: ['fatal', 'error', 'warning', 'info', 'debug'],
    },
  },
} satisfies Meta<typeof SeverityDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The five levels, most severe first. */
export const Levels: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-2">
      {(['fatal', 'error', 'warning', 'info', 'debug'] as const).map(
        (level) => (
          <div key={level} className="flex items-center gap-2.5">
            <SeverityDot level={level} />
            <span className="font-mono text-tag uppercase text-fg-muted">
              {level}
            </span>
          </div>
        ),
      )}
    </div>
  ),
};

/**
 * In a log stream the mark is the only thing that differs between rows, which
 * is exactly why it is not `aria-hidden`: without a name, every row would
 * announce identically.
 */
export const InALogRow: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex w-full max-w-lg flex-col rounded-lg bg-surface inset-ring inset-ring-border">
      {(
        [
          ['warning', '19:04:12', 'retrying upstream call'],
          ['error', '19:04:31', 'pool exhausted after 30000ms'],
          ['debug', '19:04:33', 'connection released'],
        ] as const
      ).map(([level, time, message]) => (
        <div
          key={time}
          className="flex items-center gap-3 px-3 py-2 not-last:border-b not-last:border-border"
        >
          <SeverityDot level={level} />
          <time className="shrink-0 font-mono text-code text-fg-muted">
            {time}
          </time>
          <span className="min-w-0 truncate text-body text-fg-secondary">
            {message}
          </span>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Each mark is reachable by name, so the rows are told apart by something
    // other than colour.
    await expect(canvas.getByRole('img', { name: 'error' })).toBeVisible();
    await expect(canvas.getByRole('img', { name: 'debug' })).toBeVisible();
  },
};

/** Standing alone, the bare level is not enough: say what it counts. */
export const WithItsOwnLabel: Story = {
  args: { level: 'fatal', label: '3 fatal events in the last hour' },
  play: async ({ canvasElement }) => {
    const dot = within(canvasElement).getByRole('img', {
      name: '3 fatal events in the last hour',
    });
    await expect(dot).toBeVisible();
  },
};
