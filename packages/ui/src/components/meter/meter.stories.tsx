import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Meter } from './meter';

const meta = {
  title: 'Components/Meter',
  component: Meter,
  args: { value: 72, label: 'Quota used' },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['brand', 'success', 'warning', 'error', 'neutral'],
    },
  },
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Meter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Tones: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-3">
      <Meter tone="success" value={99.4} label="Crash-free sessions" />
      <Meter tone="brand" value={64} label="Release adoption" />
      <Meter tone="warning" value={81} label="Quota used" />
      <Meter tone="error" value={97} label="Quota used" />
      <Meter tone="neutral" value={38} label="Storage used" />
    </div>
  ),
};

/**
 * `role="meter"`, not `progressbar`. The spec draws the line at whether
 * something is advancing towards completion; quota used is a measurement.
 */
export const AnnouncesItself: Story = {
  args: {
    value: 99.4,
    label: 'Crash-free sessions',
    valueText: '99.4% crash free',
    tone: 'success',
  },
  play: async ({ canvasElement }) => {
    const meter = within(canvasElement).getByRole('meter', {
      name: 'Crash-free sessions',
    });

    await expect(meter).toHaveAttribute('aria-valuenow', '99.4');
    // The bare number would be read as "99.4" with no unit and no direction.
    await expect(meter).toHaveAttribute('aria-valuetext', '99.4% crash free');
  },
};

/**
 * Values arrive from an API, so they are clamped rather than trusted. A
 * division by a zero denominator upstream reaches this component as NaN or
 * Infinity, and both would render as something that looks like a rendering bug.
 */
export const SurvivesBadData: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-3">
      <Meter value={-40} label="Negative" />
      <Meter value={9001} label="Over the maximum" />
      <Meter value={Number.NaN} label="Not a number" />
      <Meter value={50} min={0} max={0} label="Empty range" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const widthOf = (name: string) => {
      const track = canvas.getByRole('meter', { name });
      const fill = track.firstElementChild as HTMLElement;
      return fill.style.width;
    };

    await expect(widthOf('Negative')).toBe('0%');
    await expect(widthOf('Over the maximum')).toBe('100%');
    await expect(widthOf('Not a number')).toBe('0%');
    // A zero-width range has no proportion to express, so it reads as empty
    // rather than dividing by zero into Infinity.
    await expect(widthOf('Empty range')).toBe('0%');

    // The announcement is clamped too, not just the bar. The first version of
    // this component clamped only the width and emitted `aria-valuenow="NaN"`,
    // which is invalid ARIA: the bar looked right and the screen reader got
    // garbage. axe caught it, which is why a11y failures break the build here.
    await expect(
      canvas.getByRole('meter', { name: 'Not a number' }),
    ).toHaveAttribute('aria-valuenow', '0');
    await expect(
      canvas.getByRole('meter', { name: 'Over the maximum' }),
    ).toHaveAttribute('aria-valuenow', '100');
  },
};

/** The track takes the width it is given, down to a narrow column. */
export const Responsive: Story = {
  parameters: { controls: { disable: true } },
  decorators: [],
  render: () => (
    <div className="flex flex-col gap-4">
      {['w-full max-w-96', 'w-48', 'w-24'].map((width) => (
        <div key={width} className={width}>
          <Meter value={72} tone="brand" label={`Quota used (${width})`} />
        </div>
      ))}
    </div>
  ),
};
