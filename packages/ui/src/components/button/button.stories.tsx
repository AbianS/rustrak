import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  CreateIcon,
  DeleteIcon,
  IssueIcon,
  ReopenIcon,
  ResolveIcon,
} from '../icon/icon-catalog';
import { Button } from './button';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Resolve', onClick: fn() },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'ghost', 'danger', 'dashed'],
    },
    size: { control: 'inline-radio', options: ['sm', 'md', 'lg'] },
    icon: { table: { disable: true } },
    render: { table: { disable: true } },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The action that settles what is being looked at. One per screen. */
export const Primary: Story = {
  args: { variant: 'primary', size: 'lg', icon: ResolveIcon },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Assign', icon: IssueIcon },
};

/** The default weight: this is what fills a toolbar. */
export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Ignore' },
};

/** Tinted, never solid red: a solid red gets pressed before it gets read. */
export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete project', icon: DeleteIcon },
};

/** A gap to be filled, not an action on something that already exists. */
export const Dashed: Story = {
  args: { variant: 'dashed', children: 'Add alert rule', icon: CreateIcon },
};

/** Runs nothing: it groups actions behind a menu. */
export const Menu: Story = {
  args: { variant: 'ghost', children: 'More actions', menu: true },
};

/** With no label the type demands `aria-label`, and with it the button
 * announces itself. */
export const IconOnly: Story = {
  args: {
    variant: 'ghost',
    children: undefined,
    'aria-label': 'Reopen issue',
    icon: ReopenIcon,
  },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'Reopen issue',
    });
    await expect(button).toBeInTheDocument();
  },
};

/** Blocks interaction and swaps the icon for the spinner. */
export const Loading: Story = {
  args: { variant: 'primary', loading: true, icon: ResolveIcon },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
  },
};

/**
 * Disabled does not sink: nothing happened worth celebrating.
 *
 * This is not checked with a click. The base sets
 * `disabled:pointer-events-none`, so the element cannot receive the pointer and
 * `userEvent` refuses to pretend otherwise: the attempt fails before reaching
 * the assertion. What is checked is what actually protects the user, which is
 * that the button is out of the tab order and cannot be fired from the
 * keyboard.
 */
export const Disabled: Story = {
  args: { variant: 'primary', disabled: true },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    await expect(button).toBeDisabled();

    await userEvent.tab();
    await expect(button).not.toHaveFocus();
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

/** The five variants across the three sizes, which is how they get reviewed. */
export const Scale: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-4">
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="flex items-center gap-2.5">
          <Button variant="primary" size={size} icon={ResolveIcon}>
            Resolve
          </Button>
          <Button variant="secondary" size={size}>
            Assign
          </Button>
          <Button variant="ghost" size={size}>
            Ignore
          </Button>
          <Button variant="danger" size={size} icon={DeleteIcon}>
            Delete
          </Button>
          <Button variant="dashed" size={size} icon={CreateIcon}>
            Add
          </Button>
          <Button
            variant="ghost"
            size={size}
            icon={ReopenIcon}
            aria-label={`Reopen (${size})`}
          />
        </div>
      ))}
    </div>
  ),
};

/**
 * `selected` says "this filter is on right now". Ghost only: a primary is
 * already the main action, it cannot also be active.
 */
export const Selected: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex items-center gap-2.5">
      <Button variant="ghost" selected>
        Unresolved
      </Button>
      <Button variant="ghost">Resolved</Button>
      <Button variant="ghost">Ignored</Button>
    </div>
  ),
};
