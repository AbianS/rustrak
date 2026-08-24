import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ColumnFiltersState } from '@tanstack/react-table';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import type { FilterOption } from '../data-table/features';
import { IssuesIcon, ReleasesIcon, TimeIcon } from '../icon/icon-catalog';
import { Text } from '../text/text';
import { QueryBar } from './query-bar';
import type { QueryField } from './query-bar-parts';

const LEVELS: FilterOption[] = [
  { value: 'fatal', label: 'Fatal', tone: 'error', count: 5 },
  { value: 'error', label: 'Error', tone: 'error', count: 97 },
  { value: 'warning', label: 'Warning', tone: 'warning', count: 31 },
  { value: 'info', label: 'Info', tone: 'info', count: 10 },
];

const RELEASES: FilterOption[] = Array.from({ length: 12 }, (_, index) => ({
  value: `2.${11 - index}.0`,
  label: `2.${11 - index}.0`,
  count: ((index * 53) % 300) + 4,
}));

/** Rejects the first call, resolves every call after -- a transient failure. */
function flakyLoadOptions() {
  let attempt = 0;
  return () => {
    attempt += 1;
    if (attempt === 1) return Promise.reject(new Error('network blip'));
    return Promise.resolve(LEVELS);
  };
}

const FIELDS: QueryField[] = [
  {
    key: 'level',
    label: 'Level',
    icon: IssuesIcon,
    description: 'severity',
    variant: 'options',
    options: LEVELS,
  },
  {
    key: 'release',
    label: 'Release',
    icon: ReleasesIcon,
    description: 'first seen in',
    variant: 'options',
    // Fetched when asked for, so the popup shows its skeleton first.
    loadOptions: () =>
      new Promise((resolve) => setTimeout(() => resolve(RELEASES), 600)),
  },
  {
    key: 'events',
    label: 'Events',
    icon: TimeIcon,
    description: 'count range',
    variant: 'range',
  },
];

function Harness({
  initialFilters = [] as ColumnFiltersState,
  initialSearch = '',
}) {
  const [filters, setFilters] = useState<ColumnFiltersState>(initialFilters);
  const [search, setSearch] = useState(initialSearch);

  return (
    <div className="flex w-full max-w-160 flex-col gap-4">
      <QueryBar
        fields={FIELDS}
        filters={filters}
        search={search}
        onChange={(next) => {
          setFilters(next.filters);
          setSearch(next.search);
        }}
      />
      {/* The committed state, readable by eye and by the play functions. */}
      <Text variant="mono-sm" tone="ghost" data-testid="committed">
        filters={JSON.stringify(filters)} search={JSON.stringify(search)}
      </Text>
    </div>
  );
}

const meta = {
  title: 'Components/QueryBar',
  component: QueryBar,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof QueryBar>;

export default meta;
type Story = StoryObj;

export const Basic: Story = {
  render: () => <Harness />,
};

/** Every state side by side: resting, chips of each variant, free text. */
export const States: Story = {
  parameters: { controls: { disable: true } },
  render: () => (
    <div className="flex flex-col gap-4">
      <Harness />
      <Harness initialFilters={[{ id: 'level', value: ['error', 'fatal'] }]} />
      <Harness initialFilters={[{ id: 'events', value: [100, null] }]} />
      <Harness initialSearch="connection reset" />
    </div>
  ),
};

export const WithFilters: Story = {
  render: () => (
    <Harness
      initialFilters={[
        { id: 'level', value: ['error', 'fatal'] },
        { id: 'events', value: [100, null] },
      ]}
      initialSearch="timeout"
    />
  ),
};

/**
 * The two-phase autocomplete: typing offers fields, choosing one turns the
 * popup to its values, and a chosen value becomes a chip with the filter
 * applied -- no Apply step anywhere.
 */
export const CompleteAFilter: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox');

    await userEvent.click(input);
    await userEvent.keyboard('lev');
    const fieldOption = await canvas.findByRole('option', { name: /Level/ });
    await expect(fieldOption).toBeInTheDocument();

    // Enter takes the highlighted field. The phase is state, not prose: the
    // input comes back clean and only the placeholder names the field.
    await userEvent.keyboard('{Enter}');
    await expect(input).toHaveValue('');
    await expect(input).toHaveAttribute('placeholder', 'Level…');

    // The popup now offers the field's values; picking one applies it.
    await canvas.findByRole('option', { name: /Warning/ });
    await userEvent.keyboard('warn{Enter}');
    await expect(input).toHaveValue('');

    await waitFor(() =>
      expect(canvas.getByTestId('committed').textContent).toContain(
        '{"id":"level","value":["warning"]}',
      ),
    );
    await expect(canvas.getByText('level:')).toBeInTheDocument();
    await expect(canvas.getByText('warning')).toBeInTheDocument();
  },
};

/** What no key claims is the search, and Enter is what sends it. */
export const FreeText: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox');

    await userEvent.click(input);
    await userEvent.keyboard('connection reset');
    // Nothing commits while typing.
    await expect(canvas.getByTestId('committed').textContent).toContain(
      'search=""',
    );

    await userEvent.keyboard('{Escape}'); // suggestions out of the way
    await userEvent.keyboard('{Enter}');
    await waitFor(() =>
      expect(canvas.getByTestId('committed').textContent).toContain(
        'search="connection reset"',
      ),
    );
  },
};

/** Backspace on an empty input eats the last chip, like every tag input. */
export const RemoveWithBackspace: Story = {
  render: () => (
    <Harness initialFilters={[{ id: 'level', value: ['error'] }]} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox');

    await userEvent.click(input);
    await userEvent.keyboard('{Backspace}');
    await waitFor(() =>
      expect(canvas.getByTestId('committed').textContent).toContain(
        'filters=[]',
      ),
    );
  },
};

/**
 * A phone-width bar wraps. Every chip stays visible and removable -- the
 * field grows a row instead of clipping the third chip out of existence.
 */
export const Narrow: Story = {
  render: () => (
    <div className="w-80">
      <Harness
        initialFilters={[
          { id: 'level', value: ['error', 'fatal'] },
          { id: 'release', value: ['2.11.0'] },
          { id: 'events', value: [100, null] },
        ]}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Nothing is clipped: all three filters keep their remove control.
    for (const name of ['Level', 'Release', 'Events']) {
      const remove = canvas.getByRole('button', {
        name: `Remove ${name} filter`,
      });
      await expect(remove).toBeInTheDocument();
      const box = remove.getBoundingClientRect();
      await expect(box.width).toBeGreaterThan(0);
    }
  },
};

/**
 * A rejected load must not read as "loaded, and empty" forever: leaving the
 * field and coming back has to retry rather than stay stuck.
 */
export const RetriesAfterAFailedLoad: Story = {
  render: function RetriesAfterAFailedLoadStory() {
    // One closure for the story's lifetime, so the second attempt is really
    // the second call and not a fresh counter from a re-render.
    const [loadOptions] = useState(() => flakyLoadOptions());
    const [fields] = useState<QueryField[]>(() => [
      ...FIELDS,
      { key: 'flaky', label: 'Flaky', variant: 'options', loadOptions },
    ]);
    const [filters, setFilters] = useState<ColumnFiltersState>([]);
    const [search, setSearch] = useState('');
    return (
      <QueryBar
        fields={fields}
        filters={filters}
        search={search}
        onChange={(next) => {
          setFilters(next.filters);
          setSearch(next.search);
        }}
      />
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox');

    await userEvent.click(input);
    await userEvent.keyboard('flaky{Enter}');

    // The first attempt rejects: the skeleton ends rather than spinning
    // forever, and nothing is offered yet.
    await waitFor(() =>
      expect(canvas.getByText('Nothing matches')).toBeInTheDocument(),
    );

    // Leaving the field and picking it again is a new attempt.
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('flaky{Enter}');

    await waitFor(() =>
      expect(canvas.getByRole('option', { name: /Fatal/ })).toBeInTheDocument(),
    );
  },
};

/** A typed token commits whole: `events:100..500` needs no popup at all. */
export const TypedRange: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole('combobox');

    await userEvent.click(input);
    await userEvent.keyboard('events:100..500{Enter}');
    await waitFor(() =>
      expect(canvas.getByTestId('committed').textContent).toContain(
        '{"id":"events","value":[100,500]}',
      ),
    );
  },
};
