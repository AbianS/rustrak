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
