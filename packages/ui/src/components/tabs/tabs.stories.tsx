import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { Count } from '../count/count';
import { Text } from '../text/text';
import { Tab, TabList, TabPanel, Tabs } from './tabs';

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const ISSUE_TABS = [
  { value: 'unresolved', label: 'Unresolved', count: '143' },
  { value: 'resolved', label: 'Resolved', count: '1.208' },
  { value: 'muted', label: 'Muted', count: '36' },
  { value: 'all', label: 'All', count: '1.387' },
];

/** How a list splits itself: a word, a count, and the lime rule underneath. */
export const IssueViews: Story = {
  render: () => (
    <div className="w-[640px]">
      <Tabs defaultValue="unresolved">
        <TabList>
          {ISSUE_TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value}>
              {tab.label}
              <Count>{tab.count}</Count>
            </Tab>
          ))}
        </TabList>
        {ISSUE_TABS.map((tab) => (
          <TabPanel key={tab.value} value={tab.value}>
            <Text tone="muted">
              {tab.count} issues in {tab.label.toLowerCase()}.
            </Text>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  ),
};

/** The record's tabs, one step smaller because the header above is busy. */
export const RecordViews: Story = {
  render: () => (
    <div className="w-[640px]">
      <Tabs defaultValue="details">
        <TabList>
          <Tab size="sm" value="details">
            Details
          </Tab>
          <Tab size="sm" value="events">
            Events
            <Count>12,4 K</Count>
          </Tab>
          <Tab size="sm" value="breadcrumbs">
            Breadcrumbs
          </Tab>
          <Tab size="sm" value="traces">
            Traces
          </Tab>
          <Tab size="sm" value="activity">
            Activity
            <Count>3</Count>
          </Tab>
        </TabList>
        <TabPanel value="details">
          <Text tone="muted">The stack, the tags, the release.</Text>
        </TabPanel>
        <TabPanel value="events">
          <Text tone="muted">Every occurrence, filterable.</Text>
        </TabPanel>
        <TabPanel value="breadcrumbs">
          <Text tone="muted">The path to the exception.</Text>
        </TabPanel>
        <TabPanel value="traces">
          <Text tone="muted">The request as a waterfall.</Text>
        </TabPanel>
        <TabPanel value="activity">
          <Text tone="muted">Who did what to this issue.</Text>
        </TabPanel>
      </Tabs>
    </div>
  ),
};

/** The strip can carry a summary on the far right without becoming a toolbar. */
export const WithMeta: Story = {
  render: () => (
    <div className="w-[640px]">
      <Tabs defaultValue="unresolved">
        <TabList
          meta={
            <Text variant="mono-sm" tone="placeholder">
              2 filters · sort: events desc
            </Text>
          }
        >
          {ISSUE_TABS.slice(0, 3).map((tab) => (
            <Tab key={tab.value} value={tab.value}>
              {tab.label}
              <Count>{tab.count}</Count>
            </Tab>
          ))}
        </TabList>
        <TabPanel value="unresolved" />
        <TabPanel value="resolved" />
        <TabPanel value="muted" />
      </Tabs>
    </div>
  ),
};

/**
 * Manual activation, which is Base UI's default and is kept on purpose: the
 * arrows move focus, Enter chooses. Each of these tabs is a different query, so
 * activating on focus would fire one on every keypress on the way across.
 */
export const TheArrowKeysMoveFocusAndEnterChooses: Story = {
  render: () => (
    <div className="w-[640px]">
      <Tabs defaultValue="unresolved">
        <TabList>
          {ISSUE_TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tab>
          ))}
        </TabList>
        {ISSUE_TABS.map((tab) => (
          <TabPanel key={tab.value} value={tab.value}>
            {tab.label}
          </TabPanel>
        ))}
      </Tabs>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const first = canvas.getByRole('tab', { name: 'Unresolved' });

    await userEvent.click(first);
    await expect(first).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowRight}');
    const second = canvas.getByRole('tab', { name: 'Resolved' });
    await expect(second).toHaveFocus();
    // Focus moved; the selection has not.
    await expect(second).toHaveAttribute('aria-selected', 'false');

    await userEvent.keyboard('{Enter}');
    await expect(second).toHaveAttribute('aria-selected', 'true');
  },
};

/** Selection is never only lime: the selected tab also gains weight. */
export const SelectionIsNotOnlyColour: Story = {
  render: () => (
    <div className="w-[640px]">
      <Tabs defaultValue="resolved">
        <TabList>
          {ISSUE_TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tab>
          ))}
        </TabList>
        {ISSUE_TABS.map((tab) => (
          <TabPanel key={tab.value} value={tab.value} />
        ))}
      </Tabs>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const selected = within(canvasElement).getByRole('tab', {
      name: 'Resolved',
    });

    await expect(getComputedStyle(selected).fontWeight).toBe('600');
  },
};
