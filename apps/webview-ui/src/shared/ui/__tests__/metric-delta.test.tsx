import { render, screen } from '@testing-library/react';
import { deltaTone, MetricDeltaText } from '@/shared/ui/metric-delta';

describe('deltaTone', () => {
  it('is neutral when nothing changed, whatever the polarity', () => {
    expect(deltaTone(0, 'up-is-bad')).toContain('text-muted-foreground');
    expect(deltaTone(0, 'up-is-good')).toContain('text-muted-foreground');
  });

  it('reads a rise as bad news under up-is-bad', () => {
    expect(deltaTone(0.2, 'up-is-bad')).toContain('text-red-600');
    expect(deltaTone(-0.2, 'up-is-bad')).toContain('text-green-600');
  });

  it('reads a rise as good news under up-is-good', () => {
    expect(deltaTone(0.2, 'up-is-good')).toContain('text-green-600');
    expect(deltaTone(-0.2, 'up-is-good')).toContain('text-red-600');
  });
});

describe('<MetricDeltaText />', () => {
  it('renders a signed percentage for a rise', () => {
    render(
      <MetricDeltaText
        metric={{ current: 120, previous: 100 }}
        polarity="up-is-bad"
      />,
    );

    expect(screen.getByText('+20.0%')).toBeInTheDocument();
  });

  it('colours a rise red when up is bad', () => {
    const { container } = render(
      <MetricDeltaText
        metric={{ current: 120, previous: 100 }}
        polarity="up-is-bad"
      />,
    );

    const el = container.querySelector('span');
    expect(el?.className).toContain('text-red-600');
  });

  it('colours the same rise green when up is good', () => {
    const { container } = render(
      <MetricDeltaText
        metric={{ current: 120, previous: 100 }}
        polarity="up-is-good"
      />,
    );

    const el = container.querySelector('span');
    expect(el?.className).toContain('text-green-600');
  });

  it('renders a fall with a minus sign and no explicit plus', () => {
    render(
      <MetricDeltaText
        metric={{ current: 80, previous: 100 }}
        polarity="up-is-bad"
      />,
    );

    expect(screen.getByText('-20.0%')).toBeInTheDocument();
  });

  // The flat case has its own rendering: a horizontal arrow instead of a
  // diagonal one, and the muted tone rather than red or green. It is the only
  // branch where the polarity is deliberately ignored.
  it('renders a flat change with a sideways arrow and the muted tone', () => {
    const { container } = render(
      <MetricDeltaText
        metric={{ current: 100, previous: 100 }}
        polarity="up-is-bad"
      />,
    );

    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(container.querySelector('span')?.className).toContain(
      'text-muted-foreground',
    );
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(
      'lucide-arrow-right',
    );
  });

  it('renders a dash, not 0.0%, when there is no previous window', () => {
    const { container } = render(
      <MetricDeltaText
        metric={{ current: 120, previous: null }}
        polarity="up-is-bad"
      />,
    );

    expect(screen.queryByText('+20.0%')).toBeNull();
    expect(container.textContent).toBe('–');
  });

  it('renders a dash when the previous window is zero', () => {
    const { container } = render(
      <MetricDeltaText
        metric={{ current: 5, previous: 0 }}
        polarity="up-is-bad"
      />,
    );

    expect(container.textContent).toBe('–');
  });

  it('renders the arrow as decorative so it is not announced', () => {
    const { container } = render(
      <MetricDeltaText
        metric={{ current: 120, previous: 100 }}
        polarity="up-is-bad"
      />,
    );

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });
});
