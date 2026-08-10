import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../button/button';
import { DeleteIcon, ReopenIcon, ResolveIcon } from '../icon/icon-catalog';
import { Tooltip, TooltipProvider } from './tooltip';

const meta = {
  title: 'Components/Tooltip',
  component: Tooltip,
  args: {
    content: 'Reopen issue',
    side: 'top',
    // `children` is required, so it belongs in the meta: without it every
    // story has to repeat the trigger in `args` as well as in `render`.
    children: (
      <Button variant="ghost" icon={ReopenIcon} aria-label="Reopen issue" />
    ),
  },
  argTypes: {
    side: {
      control: 'inline-radio',
      options: ['top', 'right', 'bottom', 'left'],
    },
  },
  // One provider for the whole canvas, the way the application mounts one at
  // its root. A second one anywhere down the tree silently splits the shared
  // open-delay timer.
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

export const Default: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="ghost" icon={ReopenIcon} aria-label="Reopen issue" />
    </Tooltip>
  ),
};

/**
 * The tooltip makes the name visible; it does not supply it. The button
 * already carries `aria-label`, and the type enforces that, so a person using
 * a screen reader never depends on hovering.
 */
export const DoesNotCarryTheName: Story = {
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="ghost" icon={ReopenIcon} aria-label="Reopen issue" />
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Reopen issue',
    });

    // Named before anything is hovered.
    await expect(button).toBeVisible();
  },
};

/** Opens on hover, and the panel is found through the portal, not the canvas. */
export const OpensOnHover: Story = {
  args: { delay: 0 },
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="ghost" icon={ResolveIcon} aria-label="Resolve" />
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    await userEvent.hover(button);
    // The popup is portalled to the body, so the query is document-wide.
    await waitFor(() =>
      expect(within(document.body).getByText('Reopen issue')).toBeVisible(),
    );

    await userEvent.unhover(button);
    await waitFor(() =>
      expect(within(document.body).queryByText('Reopen issue')).toBeNull(),
    );
  },
};

/** `disabled` suppresses the panel without unmounting the control. */
export const Disabled: Story = {
  args: { disabled: true, delay: 0 },
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="ghost" icon={DeleteIcon} aria-label="Delete" />
    </Tooltip>
  ),
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    await userEvent.hover(button);
    await expect(within(document.body).queryByText('Reopen issue')).toBeNull();
    // The control itself is untouched.
    await expect(button).toBeEnabled();
  },
};

/** A toolbar of icon-only actions, which is what this exists for. */
export const InAToolbar: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-1 rounded-lg bg-surface p-1.5 inset-ring inset-ring-border">
      {(
        [
          [ResolveIcon, 'Resolve'],
          [ReopenIcon, 'Reopen'],
          [DeleteIcon, 'Delete'],
        ] as const
      ).map(([icon, label]) => (
        <Tooltip key={label} content={label}>
          <Button variant="ghost" size="sm" icon={icon} aria-label={label} />
        </Tooltip>
      ))}
    </div>
  ),
};
