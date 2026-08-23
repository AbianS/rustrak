import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { SegmentedControl, SegmentedItem } from './segmented-control';

const meta = {
  title: 'Components/SegmentedControl',
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const RANGES = ['1 h', '24 h', '7 d', '14 d', '30 d', 'All'];

function Ranges(props: {
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}) {
  return (
    <SegmentedControl defaultValue="24 h" aria-label="Time range" {...props}>
      {RANGES.map((range) => (
        <SegmentedItem key={range} value={range}>
          {range}
        </SegmentedItem>
      ))}
    </SegmentedControl>
  );
}

/** The time range, which is the control this exists for. */
export const TimeRange: Story = {
  render: () => <Ranges />,
};

/** Two options is the floor: below that it is a switch, not a segment. */
export const TwoOptions: Story = {
  render: () => (
    <SegmentedControl defaultValue="desc" aria-label="Sort direction">
      <SegmentedItem value="desc">Descending</SegmentedItem>
      <SegmentedItem value="asc">Ascending</SegmentedItem>
    </SegmentedControl>
  ),
};

/** An option can be off without the control being off. */
export const WithADisabledOption: Story = {
  render: () => (
    <SegmentedControl defaultValue="24 h" aria-label="Time range">
      <SegmentedItem value="1 h">1 h</SegmentedItem>
      <SegmentedItem value="24 h">24 h</SegmentedItem>
      <SegmentedItem value="7 d">7 d</SegmentedItem>
      <SegmentedItem value="all" disabled>
        All
      </SegmentedItem>
    </SegmentedControl>
  ),
};

/**
 * It is a radio group, so it announces itself as one and the browser will not
 * let it end up empty.
 */
export const ItIsARadioGroup: Story = {
  render: () => <Ranges />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(
      canvas.getByRole('radiogroup', { name: 'Time range' }),
    ).toBeInTheDocument();
    await expect(canvas.getAllByRole('radio')).toHaveLength(RANGES.length);
    await expect(canvas.getByRole('radio', { name: '24 h' })).toBeChecked();
  },
};

export const OnlyOneAtATime: Story = {
  render: () => <Ranges />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const before = canvas.getByRole('radio', { name: '24 h' });
    const after = canvas.getByRole('radio', { name: '7 d' });

    await expect(before).toBeChecked();
    await userEvent.click(after);
    await expect(after).toBeChecked();
    await expect(before).not.toBeChecked();
  },
};

/**
 * The reason this is a radio group and not a toggle group.
 *
 * Clicking the chosen option used to switch it off, leaving "1 h · 24 h · 7 d"
 * with none of them lit and a chart with no range behind it. There is no such
 * state, and a radio group does not have one.
 */
export const TheChosenOptionCannotBeSwitchedOff: Story = {
  render: () => <Ranges />,
  play: async ({ canvasElement }) => {
    const chosen = within(canvasElement).getByRole('radio', { name: '24 h' });

    await userEvent.click(chosen);
    await userEvent.click(chosen);

    await expect(chosen).toBeChecked();
  },
};

/**
 * The chip travels rather than blinking out and in somewhere else.
 *
 * It is one absolutely positioned element behind the labels, moved with
 * `translate` and resized to the chosen option, so what the eye follows is a
 * single object changing place.
 */
export const TheChipSlides: Story = {
  render: () => <Ranges />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const group = canvas.getByRole('radiogroup');
    const chip = group.querySelector('[aria-hidden="true"]') as HTMLElement;

    await expect(chip).toBeInTheDocument();

    // It moves, and the transition names the properties Tailwind actually
    // writes. `transform` would be a transition on a property that never
    // changes: see `lib/motion.ts`.
    const style = getComputedStyle(chip);
    await expect(style.transitionProperty).toContain('translate');
    await expect(style.transitionProperty).toContain('width');
    await expect(style.transitionProperty).not.toContain('transform');

    const before = chip.style.translate;
    await userEvent.click(canvas.getByRole('radio', { name: 'All' }));

    await waitFor(() => expect(chip.style.translate).not.toBe(before));
  },
};

/** Arrow keys move through the options, which is what a radio group does. */
export const TheArrowKeysMove: Story = {
  render: () => <Ranges />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chosen = canvas.getByRole('radio', { name: '24 h' });

    await userEvent.click(chosen);
    await userEvent.keyboard('{ArrowRight}');

    await expect(canvas.getByRole('radio', { name: '7 d' })).toBeChecked();
  },
};
