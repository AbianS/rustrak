import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
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
