import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Sparkline } from '../chart/sparkline';
import { Tag } from '../tag/tag';
import { Text } from '../text/text';
import { Card, CardBody, CardEmpty, CardHeader } from './card';

const meta = {
  title: 'Components/Card',
  component: Card,
  parameters: { layout: 'padded', controls: { disable: true } },
  // Every story writes its own children as JSX, so the meta only has to
  // satisfy the type.
  args: { children: null },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

const TRAFFIC = [4, 9, 6, 12, 8, 14, 11, 19, 24, 17, 22, 31, 27, 35];

/**
 * The four shapes a card comes in, side by side: bare, with a subtitle, with an
 * action, and empty. It is the comparison that catches drift -- a header whose
 * padding moved in one branch is invisible on four separate pages.
 */
export const States: Story = {
  render: () => (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader title="Events" />
        <CardBody>
          <Text variant="numeric-lg">12,403</Text>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          subtitle="Over the last 24 hours, by severity"
          title="Error volume"
        />
        <CardBody>
          <Sparkline label="Events, last 14 buckets" values={TRAFFIC} />
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          actions={<Tag tone="error">3 fatal</Tag>}
          title="Top issues"
        />
        <CardBody>
          {[
            ['TypeError: undefined', '812'],
            ['ConnectionTimeout', '410'],
            ['ValidationError', '96'],
          ].map(([title, count]) => (
            <div
              key={title}
              className="flex items-baseline justify-between gap-3 border-b border-border-divider py-2 last:border-0"
            >
              <Text truncate variant="value">
                {title}
              </Text>
              <Text tone="tertiary" variant="mono">
                {count}
              </Text>
            </div>
          ))}
        </CardBody>
      </Card>

      <Card>
        <CardHeader subtitle="Crash-free per release" title="Release health" />
        <CardBody>
          <CardEmpty>No releases yet</CardEmpty>
        </CardBody>
      </Card>
    </div>
  ),
};

/**
 * `fill` is what makes a grid row square up: two cards side by side with
 * different amounts inside end up the same height, so the rule under them is
 * one line rather than a step.
 */
export const InAGrid: Story = {
  render: () => (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card fill>
          <CardHeader
            subtitle="14,203 events over the last 24 h"
            title="Error volume"
          />
          <CardBody>
            <Sparkline
              height={120}
              label="Events, last 14 buckets"
              tone="danger"
              values={TRAFFIC}
              width={520}
            />
          </CardBody>
        </Card>
      </div>

      <Card fill>
        <CardHeader title="Open issues" />
        <CardBody>
          <Text variant="numeric-lg">142</Text>
          <Text className="mt-1" tone="ghost" variant="hint">
            Right now, whatever the period
          </Text>
        </CardBody>
      </Card>
    </div>
  ),
};

/**
 * The title is a heading, whatever its type size says. A page of these has an
 * outline, which is the only way through a dense screen for anyone not reading
 * it by eye.
 */
export const TitleIsAHeading: Story = {
  render: () => (
    <Card>
      <CardHeader title="Session health" />
      <CardBody>
        <Text variant="body">Healthy against crashed.</Text>
      </CardBody>
    </Card>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'Session health' }),
    ).toBeInTheDocument();
  },
};
