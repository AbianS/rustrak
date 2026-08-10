import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Badge } from './badge';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  args: { children: 'CHECKOUT-API-4F2' },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: [
        'neutral',
        'brand',
        'solid',
        'fatal',
        'error',
        'warning',
        'info',
        'debug',
      ],
    },
    render: { table: { disable: true } },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default. A hairline and no fill: it reads as a value, not an alert. */
export const Neutral: Story = {};

/** Filled lime. One per screen at most, or the screen has no accent left. */
export const Brand: Story = {
  args: { tone: 'brand', children: '143' },
};

export const Solid: Story = {
  args: { tone: 'solid', children: '12,431' },
};

/** `tag` is the FATAL / NEW form: uppercase, wider tracking, smaller. */
export const Tag: Story = {
  args: { tone: 'error', tag: true, children: 'error' },
};

/** The severity scale, in the order an event can carry. */
export const Severity: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone="fatal" tag>
        fatal
      </Badge>
      <Badge tone="error" tag>
        error
      </Badge>
      <Badge tone="warning" tag>
        warning
      </Badge>
      <Badge tone="info" tag>
        info
      </Badge>
      <Badge tone="debug" tag>
        debug
      </Badge>
    </div>
  ),
};

/**
 * A badge never shrinks and never wraps, even in a row that runs out of space.
 * An identifier broken across two lines stops being an identifier.
 */
export const NeverShrinks: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="w-64 rounded-lg bg-surface p-3 inset-ring inset-ring-border">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-body text-fg">
          TypeError: Cannot read properties of undefined
        </span>
        <Badge tone="error" tag>
          error
        </Badge>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const badge = within(canvasElement).getByText('error');
    const title = within(canvasElement).getByText(/TypeError/);

    // The title gives way, the badge does not. If this ever inverts, the row
    // pushes the badge out of the container instead of truncating the text.
    await expect(badge.scrollWidth).toBe(badge.clientWidth);
    await expect(title.scrollWidth).toBeGreaterThan(title.clientWidth);
  },
};

/** Polymorphic: a badge that is also a link stays one element, not two. */
export const AsLink: Story = {
  args: {
    tone: 'neutral',
    children: 'web@2026.8.1',
    // `useRender` merges the Badge's children into this element at render
    // time; the rule only ever sees the empty literal written here.
    // biome-ignore lint/a11y/useAnchorContent: see above
    render: <a href="#releases" />,
  },
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link');
    await expect(link).toHaveTextContent('web@2026.8.1');
  },
};
