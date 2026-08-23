import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from '../text/text';
import { Avatar } from './avatar';

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  args: { name: 'María López' },
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Round is a person, square is a thing. The shape is the taxonomy. */
export const ShapeIsTheTaxonomy: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-2.5">
        <Avatar name="María López" />
        <Text variant="control">María López</Text>
      </div>
      <div className="flex items-center gap-2.5">
        <Avatar shape="square" size="md" name="Checkout API" initials="JS" />
        <span className="flex flex-col">
          <Text variant="control" className="font-semibold">
            Checkout API
          </Text>
          <Text variant="hint" tone="meta">
            Acme Corp
          </Text>
        </span>
      </div>
    </div>
  ),
};

/**
 * Every shape at every size, side by side. Round against square at `sm` and at
 * `md` is the only comparison that catches the radius or the type size drifting
 * between them.
 */
export const States: Story = {
  parameters: { controls: { disable: true }, layout: 'padded' },
  render: () => (
    <div className="flex flex-col gap-4">
      {(['circle', 'square'] as const).map((shape) => (
        <div key={shape} className="flex items-center gap-4">
          <span className="w-20 shrink-0 font-mono text-column text-fg-meta uppercase">
            {shape}
          </span>
          {(['sm', 'md'] as const).map((size) => (
            <Avatar
              key={size}
              shape={shape}
              size={size}
              name="María López"
              initials={shape === 'square' ? 'JS' : undefined}
            />
          ))}
        </div>
      ))}
    </div>
  ),
};

export const Platforms: Story = {
  parameters: { layout: 'padded' },
  render: () => (
    <div className="flex items-center gap-3">
      {['JS', 'PY', 'GO', 'RS', 'SW', 'WEB'].map((platform) => (
        <Avatar
          key={platform}
          shape="square"
          size="md"
          name={platform}
          initials={platform}
        />
      ))}
    </div>
  ),
};
