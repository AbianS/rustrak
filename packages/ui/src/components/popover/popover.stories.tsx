import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../button/button';
import { FilterIcon } from '../icon/icon-catalog';
import { Text } from '../text/text';
import { Popover } from './popover';

const meta = {
  title: 'Components/Popover',
  component: Popover,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Popover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Basic: Story = {
  args: {
    trigger: (
      <Button variant="secondary" icon={FilterIcon}>
        Filter
      </Button>
    ),
    title: 'Level',
    hints: ['↑↓ move', 'Esc closes'],
    children: (
      <div className="flex flex-col gap-1 p-3">
        <Text variant="body">Interactive content lives here.</Text>
      </div>
    ),
  },
};

/**
 * The contract a menu cannot offer: the panel contains an input, focus lands on
 * it, and Escape hands focus back to the trigger.
 */
export const FocusHandling: Story = {
  args: {
    trigger: (
      <Button variant="secondary" icon={FilterIcon}>
        Filter
      </Button>
    ),
    title: 'Level',
    children: (
      <div className="p-3">
        <input
          type="text"
          aria-label="Filter values"
          placeholder="Filter…"
          className="h-control-sm w-full rounded-md border border-border-field bg-canvas px-2 text-control text-fg outline-none placeholder:text-fg-placeholder"
        />
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole('button', { name: 'Filter' });

    await userEvent.click(trigger);
    const dialog = await within(document.body).findByRole('dialog');
    await expect(dialog).toBeInTheDocument();

    // The panel is content, not a menu: its input accepts typing.
    const input = within(dialog).getByRole('textbox', {
      name: 'Filter values',
    });
    await userEvent.click(input);
    await userEvent.keyboard('error');
    await expect(input).toHaveValue('error');

    // Escape closes and the focus comes home -- after the exit transition.
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};
