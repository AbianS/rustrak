import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { Text } from '../text/text';
import { formatSpanDuration, Waterfall, type WaterfallSpan } from './waterfall';

/**
 * A checkout request worth reading: auth, an N+1 of six identical queries,
 * a render that throws, the handler that reports it, and a slow-provider
 * hole between response and reply.
 */
const TRACE: WaterfallSpan[] = [
  {
    id: 'root',
    op: 'http.server',
    description: 'POST /checkout/summary',
    startMs: 0,
    endMs: 612,
    status: 'internal_error',
  },
  {
    id: 'auth',
    parentId: 'root',
    op: 'middleware.auth',
    description: 'session u_884210',
    startMs: 6,
    endMs: 30,
  },
  {
    id: 'db-main',
    parentId: 'root',
    op: 'db.query',
    description: 'SELECT carts WHERE user_id = $1',
    startMs: 37,
    endMs: 96,
  },
  // The N+1: six identical item lookups, one per cart line.
  ...Array.from({ length: 6 }, (_, index) => ({
    id: `db-item-${index}`,
    parentId: 'db-main',
    op: 'db.query',
    description: 'SELECT items WHERE id = $1',
    startMs: 44 + index * 8,
    endMs: 50 + index * 8,
  })),
  {
    id: 'cache',
    parentId: 'root',
    op: 'cache.get',
    description: 'summary:8842',
    startMs: 101,
    endMs: 109,
  },
  {
    id: 'render',
    parentId: 'root',
    op: 'fn.renderTotals',
    description: 'summary.tsx:118',
    startMs: 171,
    endMs: 173,
    status: 'internal_error',
  },
  {
    id: 'handler',
    parentId: 'root',
    op: 'error.handler',
    description: 'capture + report to Rustrak',
    startMs: 179,
    endMs: 219,
  },
  {
    id: 'response',
    parentId: 'root',
    op: 'http.response',
    description: '500 · summary fallback',
    startMs: 440,
    endMs: 612,
  },
];

function Harness({
  spans = TRACE,
  showMissingInstrumentation = false,
}: {
  spans?: WaterfallSpan[];
  showMissingInstrumentation?: boolean;
}) {
  const [selected, setSelected] = useState<WaterfallSpan | null>(null);

  return (
    <div className="w-full max-w-260 rounded-xl border border-border-subtle bg-surface pb-3">
      <Waterfall
        spans={spans}
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
        showMissingInstrumentation={showMissingInstrumentation}
        label="Waterfall of POST /checkout/summary"
        renderDetail={(span) => (
          <dl
            data-testid="detail"
            className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1"
          >
            {(
              [
                ['Op', span.op ?? '—'],
                ['Description', span.description ?? '—'],
                ['Status', span.status ?? 'ok'],
                ['Duration', formatSpanDuration(span.endMs - span.startMs)],
              ] as const
            ).map(([term, value]) => (
              <div key={term} className="contents">
                <dt>
                  <Text variant="meta" tone="subtle">
                    {term}
                  </Text>
                </dt>
                <dd>
                  <Text variant="mono-sm" truncate>
                    {value}
                  </Text>
                </dd>
              </div>
            ))}
          </dl>
        )}
      />
    </div>
  );
}

const meta = {
  title: 'Components/Waterfall',
  component: Waterfall,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Waterfall>;

export default meta;
type Story = StoryObj;

/**
 * The whole reading at once: the ruler scaling the track, the N+1 folded
 * into one ×6 row, and the broken span carrying the only red on the page.
 */
export const Trace: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The total appears twice by design: the ruler's end and the root
    // span's own duration riding its bar.
    await expect(canvas.getAllByText('612 ms').length).toBeGreaterThan(1);

    // Six identical leaf siblings arrive as one autogrouped row.
    await expect(canvas.getByText('db.query ×6')).toBeInTheDocument();
    await expect(
      canvas.queryAllByText('SELECT items WHERE id = $1').length,
    ).toBe(1);

    // The legend names every kind present, error last.
    await expect(canvas.getByText('internal')).toBeInTheDocument();
    await expect(canvas.getByText('error')).toBeInTheDocument();
  },
};

/** Selecting a row opens its detail inside the trace; again closes it. */
export const Selection: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const row = canvas
      .getAllByRole('treeitem')
      .find((el) => el.textContent?.includes('fn.renderTotals'));
    if (!row) throw new Error('row not found');

    await userEvent.click(row);
    await expect(canvas.getByTestId('detail')).toBeInTheDocument();
    await expect(row).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(row);
    await waitFor(() =>
      expect(canvas.queryByTestId('detail')).not.toBeInTheDocument(),
    );
  },
};

/**
 * The pill folds a subtree without selecting, and says what it holds; the
 * autogroup opens the same way and shows its members.
 */
export const FoldsAndGroups: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Opening the autogroup replaces ×6 with the six real rows.
    const group = canvas
      .getAllByRole('treeitem')
      .find((el) => el.textContent?.includes('db.query ×6'));
    if (!group) throw new Error('group not found');
    await userEvent.click(group);
    await waitFor(() =>
      expect(canvas.queryByText('db.query ×6')).not.toBeInTheDocument(),
    );
    await expect(canvas.getAllByText('SELECT items WHERE id = $1').length).toBe(
      6,
    );

    // Folding db-main hides its children; no selection happened.
    const parent = canvas
      .getAllByRole('treeitem')
      .find((el) => el.textContent?.includes('SELECT carts'));
    if (!parent) throw new Error('parent not found');
    await expect(parent).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(parent);
    // Clicking a span row selects it; folding is the pill's.
    const pill = parent.querySelector('[data-chevron]');
    if (!pill) throw new Error('pill not found');
    await userEvent.click(pill as HTMLElement);
    await waitFor(() =>
      expect(parent).toHaveAttribute('aria-expanded', 'false'),
    );
    await expect(
      canvas.queryByText('SELECT items WHERE id = $1'),
    ).not.toBeInTheDocument();
  },
};

/** One tab stop; inside, the arrows walk the tree and fold it. */
export const Keyboard: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvas.getAllByRole('treeitem');
    const first = rows[0] as HTMLElement;

    first.focus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(rows[1]).toHaveFocus();

    await userEvent.keyboard('{End}');
    const focused = document.activeElement as HTMLElement;
    await expect(focused.textContent).toContain('http.response');

    await userEvent.keyboard('{Home}');
    await expect(first).toHaveFocus();

    // Left folds the focused parent; Right unfolds it.
    await userEvent.keyboard('{ArrowLeft}');
    await expect(first).toHaveAttribute('aria-expanded', 'false');
    await userEvent.keyboard('{ArrowRight}');
    await expect(first).toHaveAttribute('aria-expanded', 'true');
  },
};

/** Unclaimed time surfaces as a hatched row when asked for. */
export const MissingInstrumentation: Story = {
  render: () => <Harness showMissingInstrumentation />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // 219 ms → 440 ms: nobody claims those 221 ms, and now the row says so.
    await expect(
      canvas.getByText('missing instrumentation'),
    ).toBeInTheDocument();
    await expect(canvas.getByText('221 ms')).toBeInTheDocument();
  },
};

/** Above ~670 px of container, the split is a real, keyboard-able control. */
export const ResizableSplit: Story = {
  render: () => <Harness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const divider = canvas.getByRole('separator', {
      name: 'Resize the name column',
    });

    const before = divider.getAttribute('aria-valuenow');
    divider.focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() =>
      expect(divider.getAttribute('aria-valuenow')).not.toBe(before),
    );
  },
};

/**
 * At phone width the rows stack: the name line above, the bar below at full
 * width. Nothing is crammed into a 120 px gutter, and the divider -- which
 * would resize columns that no longer exist -- is gone.
 */
export const Narrow: Story = {
  render: () => (
    <div className="w-90">
      <Harness />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // The divider has nothing to resize here: display none takes it out of
    // the accessibility tree entirely.
    const divider = canvasElement.querySelector('[role="separator"]');
    await expect(divider).not.toBeVisible();

    // Every span still reads, and its bar gets the full row width below it.
    const row = canvas
      .getAllByRole('treeitem')
      .find((el) => el.textContent?.includes('middleware.auth'));
    if (!row) throw new Error('row not found');
    const gutter = row.firstElementChild as HTMLElement;
    const track = gutter.nextElementSibling as HTMLElement;
    await expect(
      Math.round(gutter.getBoundingClientRect().width),
    ).toBeGreaterThan(300);
    await expect(track.getBoundingClientRect().top).toBeGreaterThan(
      gutter.getBoundingClientRect().top + 10,
    );

    // Opening a detail must not widen the trace: what does not fit scrolls
    // inside the detail's own box.
    await userEvent.click(row);
    await canvas.findByTestId('detail');
    const figure = canvasElement.querySelector('figure');
    if (!figure) throw new Error('figure not found');
    await expect(figure.scrollWidth).toBeLessThanOrEqual(
      figure.clientWidth + 1,
    );
  },
};
