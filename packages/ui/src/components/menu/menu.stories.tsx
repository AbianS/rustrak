import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';
import { Button } from '../button/button';
import {
  AssignIcon,
  CopyIcon,
  DeleteIcon,
  ExportIcon,
  ExternalLinkIcon,
  MuteIcon,
  OkIcon,
  ResolveIcon,
  SaveViewIcon,
} from '../icon/icon-catalog';
import { Text } from '../text/text';
import { Menu, MenuGroup, MenuItem, MenuSeparator } from './menu';
import type { MenuAction } from './menu-parts';

const meta = {
  title: 'Components/Menu',
  component: Menu,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Menu>;

export default meta;
type Story = StoryObj<typeof meta>;

const ISSUE_ACTIONS: MenuAction[] = [
  { id: 'resolve', label: 'Resolve', icon: ResolveIcon, shortcut: 'R' },
  { id: 'mute', label: 'Mute', icon: MuteIcon, shortcut: 'M' },
  { id: 'assign', label: 'Assign to…', icon: AssignIcon, shortcut: 'A' },
  {
    id: 'copy',
    label: 'Copy issue id',
    icon: CopyIcon,
    hint: 'CHECKOUT-API-4F2',
    separated: true,
  },
  { id: 'open', label: 'Open in a new tab', icon: ExternalLinkIcon },
  {
    id: 'delete',
    label: 'Delete and discard',
    icon: DeleteIcon,
    tone: 'danger',
    separated: true,
  },
];

export const IssueActions: Story = {
  args: {
    trigger: <Button variant="secondary" menu children="Actions" />,
    actions: ISSUE_ACTIONS,
  },
};

/** Sorting: the field, its state, and what the keyboard does. */
export const WithKeyboardHints: Story = {
  args: {
    align: 'end',
    trigger: <Button variant="secondary" menu children="Sort" />,
    actions: [
      { id: 'events', label: 'Events', count: '48,2 K' },
      { id: 'users', label: 'Users', count: '842' },
      { id: 'last', label: 'Last seen' },
      { id: 'first', label: 'First seen' },
      { id: 'priority', label: 'Priority' },
    ],
    hints: ['↑↓ move', 'Enter applies', 'Esc closes'],
  },
};

/** A folder opens the next level on hover; nothing else changes. */
export const WithSubmenu: Story = {
  args: {
    trigger: <Button variant="secondary" menu children="Export" />,
    actions: [
      {
        id: 'download',
        label: 'Download',
        icon: ExportIcon,
        items: [
          { id: 'csv', label: 'CSV' },
          { id: 'json', label: 'JSON' },
          { id: 'ndjson', label: 'NDJSON' },
        ],
      },
      { id: 'save', label: 'Save this view', icon: SaveViewIcon },
    ],
  },
};

/**
 * A greyed-out action says why on hover. Without the reason, whoever is looking
 * at it is left clicking around to find out what turns it on.
 */
export const DisabledSaysWhy: Story = {
  args: {
    trigger: <Button variant="secondary" menu children="Actions" />,
    actions: [
      { id: 'resolve', label: 'Resolve', icon: ResolveIcon },
      {
        id: 'assign',
        label: 'Assign to…',
        icon: AssignIcon,
        disabled: true,
        disabledReason: 'Select at least one issue first',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button');

    await userEvent.click(trigger);

    const item = await within(document.body).findByRole('menuitem', {
      name: /Assign to/,
    });

    await expect(item).toHaveAttribute('data-disabled');
  },
};

export const ItOpensAndSelects: Story = {
  args: {
    trigger: <Button variant="secondary" menu children="Actions" />,
    actions: [
      { id: 'resolve', label: 'Resolve', icon: ResolveIcon, onSelect: fn() },
      { id: 'mute', label: 'Mute', icon: MuteIcon, onSelect: fn() },
    ],
  },
  play: async ({ args, canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button');

    await userEvent.click(trigger);

    const item = await within(document.body).findByRole('menuitem', {
      name: /Resolve/,
    });
    await userEvent.click(item);

    await expect(args.actions?.[0]?.onSelect).toHaveBeenCalledOnce();
  },
};

/** Escape closes it and focus goes back to what opened it. */
export const EscapeReturnsFocus: Story = {
  args: {
    trigger: <Button variant="secondary" menu children="Actions" />,
    actions: ISSUE_ACTIONS,
  },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button');

    await userEvent.click(trigger);
    await within(document.body).findByRole('menu');

    await userEvent.keyboard('{Escape}');

    // Base UI hands focus back once the popup has finished leaving, and it
    // leaves over `duration-fast`. Asserting straight away races the exit.
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

/**
 * A row written as JSX, for the shape `actions` cannot describe: a project with
 * its slug under it and a tick beside it. The recipe is the same either way, so
 * a custom row cannot drift from the height or the highlight of the rows above
 * it.
 *
 * This is also the story that catches the trap `MenuGroup` was built to close:
 * Base UI's group label throws unless it sits inside a group, so the heading is
 * a prop on the block rather than a component anyone can write on its own.
 */
export const CustomRows: Story = {
  args: { trigger: <Button variant="secondary">Checkout API</Button> },
  render: (args) => (
    <Menu {...args} popupClassName="w-64">
      <MenuGroup label="Switch project">
        {[
          { id: 1, name: 'Checkout API', slug: 'checkout-api', current: true },
          { id: 2, name: 'Web storefront', slug: 'storefront' },
          { id: 3, name: 'Billing worker', slug: 'billing-worker' },
        ].map((project) => (
          <MenuItem key={project.id} className="h-project-card">
            <span className="flex min-w-0 flex-1 flex-col">
              <Text truncate variant="control">
                {project.name}
              </Text>
              <Text tone="meta" truncate variant="hint">
                {project.slug}
              </Text>
            </span>
            {project.current ? (
              <OkIcon className="shrink-0 text-fg-brand" size="md" />
            ) : null}
          </MenuItem>
        ))}
      </MenuGroup>

      <MenuSeparator />

      <MenuItem>All projects</MenuItem>
    </Menu>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);

    await userEvent.click(
      within(canvasElement).getByRole('button', { name: 'Checkout API' }),
    );

    // The group is named by its heading, which is the whole reason the label
    // lives inside it rather than beside it.
    const group = await canvas.findByRole('group', { name: 'Switch project' });
    await expect(within(group).getAllByRole('menuitem')).toHaveLength(3);
    await expect(
      canvas.getByRole('menuitem', { name: 'All projects' }),
    ).toBeInTheDocument();
  },
};
