import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Button } from '../button/button';
import { ExportIcon, OverflowIcon } from '../icon/icon-catalog';
import { Tooltip, TooltipProvider } from './tooltip';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What an icon-only button is for. Mandatory on every one of them. */
export const OnAnIconButton: Story = {
  args: {
    content: 'More actions',
    children: (
      <Button variant="ghost" icon={OverflowIcon} aria-label="More actions" />
    ),
  },
};

export const Sides: Story = {
  args: { content: '', children: <span /> },
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex gap-3">
      {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
        <Tooltip key={side} content={`Opens ${side}`} side={side}>
          <Button variant="secondary" icon={ExportIcon}>
            {side}
          </Button>
        </Tooltip>
      ))}
    </div>
  ),
};

export const ItAppearsOnHover: Story = {
  args: {
    content: 'Export the filtered events',
    children: <Button variant="ghost" icon={ExportIcon} aria-label="Export" />,
  },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button');

    await userEvent.hover(trigger);

    // `findByText` waits for it; `toBeVisible` would race the entry
    // transition, which starts the popup at opacity 0 by design.
    await expect(
      await within(document.body).findByText('Export the filtered events'),
    ).toBeInTheDocument();
  },
};
