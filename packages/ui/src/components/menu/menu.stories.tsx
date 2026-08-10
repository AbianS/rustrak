import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../button/button';
import {
  AssignIcon,
  DeleteIcon,
  IgnoreIcon,
  OverflowIcon,
  ResolveIcon,
} from '../icon/icon-catalog';
import {
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuLinkItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from './menu';

const meta = {
  title: 'Components/Menu',
  component: MenuRoot,
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof MenuRoot>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The trigger is left unstyled by the menu, so a `Button` passed through
 * `render` keeps every one of its own variants.
 */
export const Default: Story = {
  render: () => (
    <MenuRoot>
      <MenuTrigger
        render={
          <Button variant="ghost" menu>
            More actions
          </Button>
        }
      />
      <MenuContent>
        <MenuItem icon={AssignIcon}>Assign to me</MenuItem>
        <MenuItem icon={ResolveIcon}>Mark as reviewed</MenuItem>
        <MenuSeparator />
        <MenuItem tone="danger" icon={DeleteIcon}>
          Delete issue
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  ),
};

/** Opens, runs the action, and closes itself afterwards. */
export const RunsAnAction: Story = {
  render: function Render() {
    const onSelect = fn();
    return (
      <MenuRoot>
        <MenuTrigger
          render={
            <Button variant="ghost" menu>
              More actions
            </Button>
          }
        />
        <MenuContent>
          <MenuItem onClick={onSelect}>Assign to me</MenuItem>
        </MenuContent>
      </MenuRoot>
    );
  },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button');

    await userEvent.click(trigger);
    const item = await waitFor(() =>
      within(document.body).getByRole('menuitem', { name: 'Assign to me' }),
    );

    await userEvent.click(item);
    // Closing on select is Base UI's behaviour and this pins it: a menu that
    // stays open after an action reads as though nothing happened.
    await waitFor(() =>
      expect(
        within(document.body).queryByRole('menuitem', { name: 'Assign to me' }),
      ).toBeNull(),
    );
  },
};

/** Keyboard: arrows move, Enter selects, Escape closes and focus comes back. */
export const Keyboard: Story = {
  render: () => (
    <MenuRoot>
      <MenuTrigger
        render={
          <Button variant="ghost" menu>
            More actions
          </Button>
        }
      />
      <MenuContent>
        <MenuItem>Assign to me</MenuItem>
        <MenuItem>Mark as reviewed</MenuItem>
      </MenuContent>
    </MenuRoot>
  ),
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button');

    trigger.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(within(document.body).getByRole('menu')).toBeVisible(),
    );

    const body = within(document.body);

    // Opening with the keyboard lands on the first item already: a menu that
    // opened with nothing highlighted would need a second keypress before the
    // arrows did anything, and there would be no visible starting point.
    await expect(
      body.getByRole('menuitem', { name: 'Assign to me' }),
    ).toHaveAttribute('data-highlighted');

    await userEvent.keyboard('{ArrowDown}');
    await expect(
      body.getByRole('menuitem', { name: 'Mark as reviewed' }),
    ).toHaveAttribute('data-highlighted');
    await expect(
      body.getByRole('menuitem', { name: 'Assign to me' }),
    ).not.toHaveAttribute('data-highlighted');

    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(within(document.body).queryByRole('menu')).toBeNull(),
    );
    // Focus returning to the trigger is what stops the keyboard user being
    // dropped at the top of the document.
    await expect(trigger).toHaveFocus();
  },
};

/** Items that navigate are real anchors, so middle-click and copy-link work. */
export const WithLinks: Story = {
  render: () => (
    <MenuRoot>
      <MenuTrigger
        render={
          <Button variant="ghost" menu>
            web@2026.8.1
          </Button>
        }
      />
      <MenuContent>
        <MenuGroup>
          <MenuGroupLabel>Recent releases</MenuGroupLabel>
          <MenuLinkItem href="#r1">web@2026.8.1</MenuLinkItem>
          <MenuLinkItem href="#r2">web@2026.8.0</MenuLinkItem>
        </MenuGroup>
      </MenuContent>
    </MenuRoot>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button'));

    const link = await waitFor(() =>
      within(document.body).getByRole('menuitem', { name: 'web@2026.8.1' }),
    );
    // An item with an onClick that calls the router would take these away.
    await expect(link).toHaveAttribute('href', '#r1');
  },
};

/**
 * The pointer is not decoration: in a flat dark interface it is the signal
 * separating "this does something" from "this is a label".
 *
 * `styles/base.css` grants it to every `[role="menuitem"]` at zero specificity,
 * which means any `cursor-*` utility on the item silently wins. This shipped
 * once with `cursor-default` on the recipe and looked completely fine.
 */
export const Cursor: Story = {
  render: () => (
    <MenuRoot>
      <MenuTrigger
        render={
          <Button variant="ghost" menu>
            More actions
          </Button>
        }
      />
      <MenuContent>
        <MenuItem icon={ResolveIcon}>Resolve</MenuItem>
        <MenuItem disabled>Already resolved</MenuItem>
      </MenuContent>
    </MenuRoot>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button'));
    const body = within(document.body);

    const item = await waitFor(() =>
      body.getByRole('menuitem', { name: 'Resolve' }),
    );
    await expect(getComputedStyle(item).cursor).toBe('pointer');

    // The two cursor lists in base.css have to stay in step: menuitem was in
    // the pointer one and missing from the disabled one, so a greyed-out entry
    // looked inert and felt like plain text.
    const disabled = body.getByRole('menuitem', { name: 'Already resolved' });
    await expect(getComputedStyle(disabled).cursor).toBe('not-allowed');
  },
};

/** The row overflow, which is where most of these live. */
export const RowActions: Story = {
  render: () => (
    <div className="flex w-full max-w-md items-center gap-3 rounded-lg bg-surface p-3 inset-ring inset-ring-border">
      <span className="min-w-0 truncate text-body text-fg">
        TypeError: Cannot read properties of undefined
      </span>
      <MenuRoot>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              icon={OverflowIcon}
              aria-label="Issue actions"
            />
          }
        />
        <MenuContent align="end">
          <MenuItem icon={ResolveIcon}>Resolve</MenuItem>
          <MenuItem icon={IgnoreIcon}>Ignore</MenuItem>
          <MenuSeparator />
          <MenuItem tone="danger" icon={DeleteIcon}>
            Delete
          </MenuItem>
        </MenuContent>
      </MenuRoot>
    </div>
  ),
};
