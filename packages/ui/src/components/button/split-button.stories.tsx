import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { AssignIcon, ExportIcon, ResolveIcon } from '../icon/icon-catalog';
import { SplitButton } from './split-button';

const meta = {
  title: 'Components/SplitButton',
  component: SplitButton,
  args: {
    children: 'Resolve',
    icon: ResolveIcon,
    menuLabel: 'More ways to resolve',
    onClick: fn(),
    actions: [
      { id: 'next', label: 'Resolve in the next release' },
      { id: 'again', label: 'Resolve until it happens again' },
      { id: 'assign', label: 'Assign and resolve', icon: AssignIcon },
    ],
  },
} satisfies Meta<typeof SplitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};

export const Secondary: Story = {
  args: {
    variant: 'secondary',
    children: 'Export',
    icon: ExportIcon,
    menuLabel: 'Other formats',
    actions: [
      { id: 'json', label: 'Export as JSON' },
      { id: 'ndjson', label: 'Export as NDJSON' },
    ],
  },
};

/** The two halves are two buttons: the leading one runs, the trailing one
    opens. Pressing the label never opens the menu. */
export const TheHalvesAreIndependent: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole('button', { name: 'Resolve' }));
    await expect(args.onClick).toHaveBeenCalledOnce();
    await expect(within(document.body).queryByRole('menu')).toBeNull();

    await userEvent.click(
      canvas.getByRole('button', { name: 'More ways to resolve' }),
    );
    // `findByRole` waits for the popup; `toBeVisible` would race the entry
    // transition, which starts it at opacity 0 by design.
    await expect(
      await within(document.body).findByRole('menu'),
    ).toBeInTheDocument();
  },
};

/**
 * The press belongs to the whole pill, not to the half you hit.
 *
 * Sinking one half tears the seam open and leaves the divider floating in a
 * gap, so the root scales instead, driven by `has-*` from either half. Opening
 * the menu holds it there: Base UI keeps `data-pressed` on the chevron for as
 * long as the panel is up, so the control stays sunk the whole time it is
 * holding something open.
 */
export const TheWholePillSinks: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chevron = canvas.getByRole('button', {
      name: 'More ways to resolve',
    });
    const root = chevron.parentElement as HTMLElement;

    const style = getComputedStyle(root);
    await expect(style.scale).toBe('none');
    // The transition has to name the property that actually changes.
    await expect(style.transitionProperty).toContain('scale');
    await expect(style.transitionProperty).not.toContain('transform');

    await userEvent.click(chevron);
    await within(document.body).findByRole('menu');

    await waitFor(() => expect(getComputedStyle(root).scale).toBe('0.97'));
    await expect(chevron).toHaveAttribute('data-popup-open');
  },
};

/**
 * The panel arrives braking and leaves accelerating, and it *moves* while it
 * does. An earlier version transitioned `transform`, which Tailwind 4 never
 * writes, so the panel only ever faded.
 *
 * This one checks the class list rather than the computed style, and that is
 * deliberate: the popup is portalled to `document.body`, and in the Vitest
 * browser environment the stylesheet does not resolve against nodes out there —
 * `transitionProperty` comes back `none` for a popup whose classes are
 * demonstrably right, and does so in the built Storybook too. The class list is
 * what this package actually owns and it is the same in every environment.
 * `lib/motion.test.ts` covers the failure mode this is guarding against across
 * the whole source tree.
 */
export const ThePanelIsAnimated: Story = {
  play: async ({ canvasElement }) => {
    const chevron = within(canvasElement).getByRole('button', {
      name: 'More ways to resolve',
    });

    await userEvent.click(chevron);

    const popup = await within(document.body).findByRole('menu');

    // The properties Tailwind actually writes, not the `transform` that it
    // never does.
    await expect(popup).toHaveClass('transition-[opacity,scale,translate]');
    // Enters over `moderate`, leaves over `fast`: what you asked to see gets
    // the time to be seen arriving, what you dismissed gets out of the way.
    await expect(popup).toHaveClass('duration-moderate');
    await expect(popup).toHaveClass('ease-entrance');
    await expect(popup).toHaveClass('data-ending-style:duration-fast');
    await expect(popup).toHaveClass('data-ending-style:ease-exit');
    // Anchored to the trigger, so it grows out of the button and not out of
    // its own centre.
    await expect(popup).toHaveClass('origin-(--transform-origin)');
  },
};
