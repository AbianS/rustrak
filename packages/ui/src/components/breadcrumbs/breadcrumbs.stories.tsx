import type { Meta, StoryObj } from '@storybook/react-vite';
import type { MouseEvent } from 'react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Breadcrumbs } from './breadcrumbs';

const meta = {
  title: 'Components/Breadcrumbs',
  component: Breadcrumbs,
} satisfies Meta<typeof Breadcrumbs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const IssueDetail: Story = {
  args: {
    items: [
      { label: 'Issues', render: <a href="#issues" /> },
      { label: 'CHECKOUT-API-4F2' },
    ],
  },
};

export const ThreeLevels: Story = {
  args: {
    items: [
      { label: 'Releases', render: <a href="#releases" /> },
      { label: 'web@2026.8.1', render: <a href="#release" /> },
      { label: 'a3f91c2' },
    ],
  },
};

/** The last crumb is where you are, so it is not a link and it says so. */
export const TheLastCrumbIsNotALink: Story = {
  args: {
    items: [
      { label: 'Issues', render: <a href="#issues" /> },
      { label: 'CHECKOUT-API-4F2' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole('link')).toHaveLength(1);
    await expect(canvas.getByText('CHECKOUT-API-4F2')).toHaveAttribute(
      'aria-current',
      'page',
    );
  },
};

/*
 * The link's own handler swallows the navigation. Following the href for real
 * would take the test page with it.
 */
const follow = fn((event: MouseEvent<HTMLAnchorElement>) =>
  event.preventDefault(),
);

/**
 * Tab reaches the crumbs that go somewhere, and Enter follows one. The trail is
 * navigation, so it has to work without a pointer.
 */
export const TheTrailIsReachableByKeyboard: Story = {
  args: {
    items: [
      {
        label: 'Issues',
        /* It is a link. The handler is only here to stop the test page
           navigating away from itself when Enter follows it. */
        // biome-ignore lint/a11y/useValidAnchor: see above
        render: <a href="#issues" onClick={follow} />,
      },
      { label: 'CHECKOUT-API-4F2' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const issues = canvas.getByRole('link', { name: 'Issues' });

    await userEvent.tab();
    await expect(issues).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    await expect(follow).toHaveBeenCalledOnce();

    // The last crumb is where you are, so tab moves past the trail entirely.
    await userEvent.tab();
    await expect(issues).not.toHaveFocus();
  },
};

/**
 * An intermediate crumb with no `render` is text, not a dead link. An `<a>`
 * without an `href` announces as nothing and cannot be reached by tab, so the
 * trail would claim a step it does not have.
 */
export const ACrumbWithNowhereToGoIsNotALink: Story = {
  args: {
    items: [
      { label: 'Releases', render: <a href="#releases" /> },
      { label: 'web@2026.8.1' },
      { label: 'a3f91c2' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getAllByRole('link')).toHaveLength(1);
    await expect(canvas.getByText('web@2026.8.1').tagName).toBe('SPAN');
  },
};
