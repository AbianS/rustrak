import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import {
  ExportIcon,
  MuteIcon,
  NewIcon,
  OverflowIcon,
  ResolveIcon,
} from '../icon/icon-catalog';
import { Menu } from '../menu/menu';
import { Button } from './button';

const meta = {
  title: 'Components/Button',
  component: Button,
  args: { children: 'Resolve', onClick: fn() },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'ghost', 'danger', 'danger-primary'],
    },
    size: { control: 'inline-radio', options: ['xs', 'sm', 'md', 'lg'] },
    icon: { table: { disable: true } },
    render: { table: { disable: true } },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {
  args: { variant: 'primary', icon: ResolveIcon, shortcut: 'R' },
};

export const Secondary: Story = {
  args: { variant: 'secondary', children: 'Mute', icon: MuteIcon },
};

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Export', icon: ExportIcon },
};

export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete project' },
};

/** A folder: it runs nothing, it groups actions behind a menu. */
export const MenuButton: Story = {
  args: { variant: 'secondary', children: 'Sort', menu: true },
};

/** With no label the type demands `aria-label`, and with it the button
    announces itself. */
export const IconOnly: Story = {
  args: {
    variant: 'ghost',
    children: undefined,
    'aria-label': 'More actions',
  },
  render: (args) => <Button {...args} icon={OverflowIcon} />,
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button', {
      name: 'More actions',
    });

    await expect(button).toBeInTheDocument();
  },
};

/** Every state at once: the comparison that reveals the drift. */
export const States: Story = {
  args: { children: undefined, 'aria-label': 'states' },
  parameters: { controls: { disable: true }, layout: 'padded' },
  render: () => (
    <div className="flex flex-col gap-4">
      {(
        ['primary', 'secondary', 'ghost', 'danger', 'danger-primary'] as const
      ).map((variant) => (
        <div key={variant} className="flex items-center gap-3">
          <span className="w-32 font-mono text-column text-fg-meta uppercase">
            {variant}
          </span>
          <Button variant={variant} icon={NewIcon}>
            New project
          </Button>
          <Button variant={variant} icon={NewIcon} disabled>
            Disabled
          </Button>
          <Button variant={variant} loading>
            Loading
          </Button>
          {variant === 'secondary' || variant === 'ghost' ? (
            <Button variant={variant} selected>
              On
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  ),
};

/** The four heights, so a toolbar that mixes them shows it here first. */
export const Sizes: Story = {
  args: { children: undefined, 'aria-label': 'sizes' },
  parameters: { controls: { disable: true }, layout: 'padded' },
  render: () => (
    <div className="flex items-center gap-3">
      {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
        <Button key={size} size={size} icon={ExportIcon}>
          {size}
        </Button>
      ))}
    </div>
  ),
};

export const DoesNotFireWhenDisabled: Story = {
  args: { disabled: true },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    await expect(button).toBeDisabled();
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const DoesNotFireWhileLoading: Story = {
  args: { loading: true, children: 'Resolving' },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    await expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button, { pointerEventsCheck: 0 });
    await expect(args.onClick).not.toHaveBeenCalled();
  },
};

export const RespondsToTheKeyboard: Story = {
  args: { variant: 'primary', shortcut: 'R' },
  play: async ({ args, canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    await userEvent.tab();
    await expect(button).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

/** `render` swaps the element without losing the look or the variants. */
export const AsALink: Story = {
  args: { variant: 'secondary', children: 'Open the release' },
  render: (args) => <Button {...args} render={<a href="#release" />} />,
  play: async ({ canvasElement }) => {
    const link = within(canvasElement).getByRole('link');

    await expect(link).toHaveAttribute('href', '#release');
  },
};

/** A toggled button says so to a screen reader, not only in lime. */
export const SelectedIsAnnounced: Story = {
  args: { variant: 'ghost', selected: true, children: 'Filters' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    await expect(button).toHaveAttribute('aria-pressed', 'true');
  },
};

/**
 * Tailwind 4 dropped `cursor: pointer` from buttons. In a flat application the
 * hand is what separates "this does something" from "this is a label", so the
 * system puts it back in `styles/base.css`. These two pin it.
 */
export const TheCursorSaysItIsPressable: Story = {
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    await expect(getComputedStyle(button).cursor).toBe('pointer');
  },
};

export const TheCursorSaysItIsNot: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');

    await expect(getComputedStyle(button).cursor).toBe('not-allowed');
  },
};

/**
 * Pressing sinks the button, and the sink is *animated*.
 *
 * The second assertion is the one that matters. Tailwind 4 compiles `scale-97`
 * to the individual `scale` property, so an earlier version of this component
 * transitioned `transform` — a property that never changed — and the button
 * snapped between the two sizes with no easing at all. Nothing threw and a
 * screenshot looked identical; it just felt dead. See `lib/motion.ts`.
 */
export const ItSinksOnPress: Story = {
  args: { variant: 'primary' },
  play: async ({ canvasElement }) => {
    const button = within(canvasElement).getByRole('button');
    const style = getComputedStyle(button);

    // `:active` cannot be forced from JavaScript, so what is checked is that
    // the rule is there and that at rest nothing is scaled.
    await expect(button).toHaveClass('active:scale-97');
    await expect(style.scale).toBe('none');

    // The transition has to cover the property that actually changes.
    await expect(style.transitionProperty).toContain('scale');
    await expect(style.transitionProperty).not.toContain('transform');
    await expect(style.transitionDuration).not.toBe('0s');
  },
};

/**
 * A button that opens a menu keeps its feedback.
 *
 * Base UI opens on pointer-down and hands pointer capture to the popup, so
 * `:active` never lands on the trigger: pressing this button used to do
 * literally nothing until the panel appeared. Base UI does set `data-pressed`
 * and holds it for as long as the menu is open, which reads better anyway — the
 * button is not being pressed, it is holding something open — and the chevron
 * turns over to say the same thing a second way.
 */
export const AMenuTriggerStaysSunkWhileOpen: Story = {
  args: { children: undefined, 'aria-label': 'trigger' },
  parameters: { controls: { disable: true } },
  render: () => (
    <Menu
      trigger={<Button variant="secondary" menu children="Sort" />}
      actions={[
        { id: 'events', label: 'Events' },
        { id: 'users', label: 'Users' },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: /Sort/ });

    await expect(getComputedStyle(trigger).scale).toBe('none');

    await userEvent.click(trigger);
    await within(document.body).findByRole('menu');

    await expect(trigger).toHaveAttribute('data-popup-open');
    await waitFor(() => expect(getComputedStyle(trigger).scale).toBe('0.97'));
  },
};
