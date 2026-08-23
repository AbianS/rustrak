import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { expect, within } from 'storybook/test';
import { Text } from './text';

const meta = {
  title: 'Components/Text',
  component: Text,
  args: { children: 'Cannot read properties of undefined' },
  argTypes: {
    render: { table: { disable: true } },
  },
} satisfies Meta<typeof Text>;

export default meta;
type Story = StoryObj<typeof meta>;

const VARIANTS = [
  'page-title',
  'title',
  'section',
  'card-title',
  'body',
  'value',
  'control',
  'label',
  'meta',
  'hint',
  'code',
  'mono',
  'mono-sm',
  'column',
  'badge',
  'tag',
  'kbd',
  'numeric',
  'numeric-lg',
] as const;

const TONES = [
  'default',
  'secondary',
  'tertiary',
  'muted',
  'subtle',
  'meta',
  'ghost',
  'placeholder',
  'disabled',
  'brand',
  'error',
  'warning',
] as const;

function Row({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="w-28 shrink-0 font-mono text-column text-fg-meta uppercase">
        {name}
      </span>
      {children}
    </div>
  );
}

/**
 * Every rank in one frame. The scale only reads as a scale when the steps are
 * next to each other: on separate pages `value` and `control` look identical.
 */
export const States: Story = {
  parameters: { controls: { disable: true }, layout: 'padded' },
  render: () => (
    <div className="flex flex-col gap-2.5">
      {VARIANTS.map((variant) => (
        <Row key={variant} name={variant}>
          <Text variant={variant}>The quick brown fox 1.204</Text>
        </Row>
      ))}
    </div>
  ),
};

/** Every tone against the canvas, which is the only place they are ever read. */
export const Tones: Story = {
  parameters: { controls: { disable: true }, layout: 'padded' },
  render: () => (
    <div className="flex flex-col gap-2.5">
      {TONES.map((tone) => (
        <Row key={tone} name={tone}>
          <Text variant="value" tone={tone}>
            Cannot read properties of undefined
          </Text>
        </Row>
      ))}
      <Row name="on-brand">
        <span className="rounded-md bg-surface-brand px-2 py-1">
          <Text variant="value" tone="on-brand">
            Cannot read properties of undefined
          </Text>
        </span>
      </Row>
    </div>
  ),
};

/**
 * The rank and the element are separate questions. `render` decides the tag, so
 * a card title is an `<h3>` here and a `<span>` in a row, and looks the same in
 * both.
 */
export const TheElementIsChosenSeparately: Story = {
  args: { variant: 'card-title', children: 'Checkout API' },
  render: (args) => <Text {...args} render={<h3 />} />,
  play: async ({ canvasElement }) => {
    const heading = within(canvasElement).getByRole('heading', {
      name: 'Checkout API',
    });

    await expect(heading.tagName).toBe('H3');
    await expect(heading).toHaveClass('text-card-title');
  },
};

/** One line, clipped. It needs a parent that is allowed to be narrower. */
export const Truncated: Story = {
  args: { variant: 'value', truncate: true },
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="flex w-sidebar min-w-0">
      <Text {...args}>
        TypeError: Cannot read properties of undefined (reading
        &lsquo;id&rsquo;)
      </Text>
    </div>
  ),
};
