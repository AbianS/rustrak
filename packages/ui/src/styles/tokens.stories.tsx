import type { Meta, StoryObj } from '@storybook/react-vite';
import { Text } from '../components/text/text';

const meta = {
  title: 'Foundations/Tokens',
  parameters: {
    layout: 'fullscreen',
    controls: { disable: true },
    a11y: { test: 'error' },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Text variant="section" render={<h2 />}>
          {title}
        </Text>
        {note ? (
          <Text variant="meta" tone="subtle" className="max-w-prose">
            {note}
          </Text>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span
        className={`size-9 shrink-0 rounded-md border border-border-subtle ${className}`}
      />
      <Text variant="mono" tone="muted" truncate>
        {name}
      </Text>
    </div>
  );
}

/** The four surfaces, in the order they stack. */
export const Surfaces: Story = {
  render: () => (
    <div className="flex flex-col gap-8 bg-canvas p-page-gutter">
      <Section
        title="Surfaces"
        note="Four levels, and going up is always lighter. In dark that is the only
        way depth reads at all: a shadow on #121212 has almost nothing to cast
        onto. In light the order flips and what rises goes towards white."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Swatch name="canvas" className="bg-canvas" />
          <Swatch name="panel" className="bg-panel" />
          <Swatch name="surface" className="bg-surface" />
          <Swatch name="surface-raised" className="bg-surface-raised" />
          <Swatch name="surface-hover" className="bg-surface-hover" />
          <Swatch name="surface-selected" className="bg-surface-selected" />
          <Swatch name="surface-chip" className="bg-surface-chip" />
          <Swatch name="surface-brand" className="bg-surface-brand" />
        </div>
      </Section>

      <Section
        title="Borders"
        note="Five weights, because a rule has to be read against whichever of
        the four surfaces it lands on."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Swatch name="border-divider" className="bg-border-divider" />
          <Swatch name="border-muted" className="bg-border-muted" />
          <Swatch name="border-subtle" className="bg-border-subtle" />
          <Swatch name="border" className="bg-border" />
          <Swatch name="border-strong" className="bg-border-strong" />
        </div>
      </Section>
    </div>
  ),
};

/** The ten steps of type colour, from a heading down to a chevron. */
export const Foreground: Story = {
  render: () => (
    <div className="flex flex-col gap-8 bg-canvas p-page-gutter">
      <Section
        title="Foreground"
        note="Ten steps sounds like a lot until you count a row: a title, an
        identifier, a timestamp, a count and a path all have to read as
        different ranks at a glance. Everything from fg-meta down is annotation
        and never carries meaning on its own — the ratios are pinned in
        contrast.test.ts."
      >
        <div className="flex flex-col gap-1">
          {(
            [
              ['fg', 'text-fg'],
              ['fg-secondary', 'text-fg-secondary'],
              ['fg-tertiary', 'text-fg-tertiary'],
              ['fg-muted', 'text-fg-muted'],
              ['fg-subtle', 'text-fg-subtle'],
              ['fg-meta', 'text-fg-meta'],
              ['fg-ghost', 'text-fg-ghost'],
              ['fg-placeholder', 'text-fg-placeholder'],
              ['fg-brand', 'text-fg-brand'],
            ] as const
          ).map(([name, className]) => (
            <div key={name} className="flex items-baseline gap-4">
              <span className="w-36 shrink-0 font-mono text-mono text-fg-meta">
                {name}
              </span>
              <span className={`text-value ${className}`}>
                TypeError: Cannot read properties of undefined
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Severity"
        note="Reserved: never reused as a chart series, and always beside a word.
        Each level has two values — mark fills a bar or a dot, fg sets a word —
        because a fill and a word need different lightness to read at the same
        strength on the same surface."
      >
        <div className="flex flex-col gap-2">
          {(
            [
              ['error', 'bg-sev-error', 'text-sev-error-fg'],
              ['warning', 'bg-sev-warning', 'text-sev-warning-fg'],
              ['info', 'bg-sev-info', 'text-sev-info-fg'],
            ] as const
          ).map(([name, mark, fg]) => (
            <div key={name} className="flex items-center gap-4">
              <span className="w-36 shrink-0 font-mono text-mono text-fg-meta">
                sev-{name}
              </span>
              <span className={`size-4 shrink-0 rounded-2xs ${mark}`} />
              <span className={`font-mono text-tag uppercase ${fg}`}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Chart"
        note="Categorical slots in a fixed order: assign by entity, never cycle,
        never reorder when a filter changes how many series there are."
      >
        {/* Written out one by one on purpose. Tailwind extracts class names
            statically, so `bg-${name}` is a name it never sees and the rule is
            silently never generated. */}
        <div className="flex gap-3">
          {(
            [
              ['1', 'bg-chart-1'],
              ['2', 'bg-chart-2'],
              ['3', 'bg-chart-3'],
              ['4', 'bg-chart-4'],
              ['5', 'bg-chart-5'],
              ['muted', 'bg-chart-muted'],
            ] as const
          ).map(([label, className]) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <span className={`size-9 rounded-md ${className}`} />
              <span className="font-mono text-mono-sm text-fg-meta">
                {label}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  ),
};

/** Every type role at its real size, prose and machine side by side. */
export const Typography: Story = {
  render: () => (
    <div className="flex flex-col gap-8 bg-canvas p-page-gutter">
      <Section
        title="Geist · prose"
        note="What a person wrote or a designer chose."
      >
        <div className="flex flex-col gap-3">
          {(
            [
              'page-title',
              'title',
              'section',
              'card-title',
              'body',
              'value',
              'control',
              'label',
              'meta',
              'hint',
            ] as const
          ).map((variant) => (
            <div key={variant} className="flex items-baseline gap-4">
              <span className="w-28 shrink-0 font-mono text-mono text-fg-meta">
                {variant}
              </span>
              <Text variant={variant}>Unresolved issues in Checkout API</Text>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Figures"
        note="The one exception to the rule above: a KPI is Geist, not Geist
        Mono. At 24 px mono stops reading as precision and starts reading as a
        terminal. Tabular figures give the alignment, which was the only reason
        mono was wanted."
      >
        <div className="flex items-baseline gap-8">
          <Text variant="numeric">48,2 K</Text>
          <Text variant="numeric-lg">99,42%</Text>
        </div>
      </Section>

      <Section
        title="Geist Mono · machine"
        note="If the value came out of the system and somebody might copy it out
        of the page, it is mono. That is the whole rule, and it is why the
        second family is in the design at all rather than being a flourish."
      >
        <div className="flex flex-col gap-3">
          {(
            [
              ['code', 'level:error,fatal'],
              ['mono', 'CHECKOUT-API-4F2'],
              ['mono-sm', '2026-08-23 11:04:37'],
              ['column', 'Last seen'],
              ['badge', '9a'],
              ['tag', 'regression'],
              ['kbd', '⌘K'],
            ] as const
          ).map(([variant, sample]) => (
            <div key={variant} className="flex items-baseline gap-4">
              <span className="w-28 shrink-0 font-mono text-mono text-fg-meta">
                {variant}
              </span>
              <Text variant={variant}>{sample}</Text>
            </div>
          ))}
        </div>
      </Section>
    </div>
  ),
};
