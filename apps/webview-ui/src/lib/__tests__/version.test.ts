import { compareVersions, normalizeVersion } from '@/lib/version';

describe('normalizeVersion', () => {
  it('strips a leading v', () => {
    expect(normalizeVersion('v1.2.3')).toBe('1.2.3');
  });

  it('strips a leading uppercase V', () => {
    expect(normalizeVersion('V1.2.3')).toBe('1.2.3');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeVersion('  1.2.3\n')).toBe('1.2.3');
  });

  it('leaves an already normalized version untouched', () => {
    expect(normalizeVersion('1.2.3')).toBe('1.2.3');
  });

  it('does not strip a v that is not leading', () => {
    expect(normalizeVersion('1.2.3-dev')).toBe('1.2.3-dev');
  });

  // The regex has no digit lookahead, so it strips the `v` from any word
  // starting with one. Harmless because the result still fails to parse as a
  // version and `compareVersions` then collapses to 0, but pinned here so the
  // day someone adds a lookahead they see what changes.
  it('strips the leading v even when what follows is not a number', () => {
    expect(normalizeVersion('vNext')).toBe('Next');
  });
});

describe('compareVersions', () => {
  it('returns 0 for equal versions', () => {
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('ignores a leading v on either side', () => {
    expect(compareVersions('v1.2.3', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.4', 'v1.2.3')).toBe(1);
  });

  it('orders by major first', () => {
    expect(compareVersions('1.9.9', '2.0.0')).toBe(-1);
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1);
  });

  it('orders by minor when major matches', () => {
    expect(compareVersions('1.2.9', '1.3.0')).toBe(-1);
    expect(compareVersions('1.3.0', '1.2.9')).toBe(1);
  });

  it('orders by patch when major and minor match', () => {
    expect(compareVersions('1.2.3', '1.2.4')).toBe(-1);
    expect(compareVersions('1.2.4', '1.2.3')).toBe(1);
  });

  it('compares numerically, not lexicographically', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBe(1);
  });

  it('ignores any prerelease or build suffix', () => {
    expect(compareVersions('1.2.3-rc.1', '1.2.3')).toBe(0);
  });

  // The load-bearing rule: an unparseable side must never look like an
  // available update, so it collapses to "no difference" rather than to an
  // ordering.
  it('returns 0 when the left side cannot be parsed', () => {
    expect(compareVersions('unknown', '1.2.3')).toBe(0);
  });

  it('returns 0 when the right side cannot be parsed', () => {
    expect(compareVersions('1.2.3', 'unknown')).toBe(0);
  });

  it('returns 0 for a partial version that is not major.minor.patch', () => {
    expect(compareVersions('1.2', '1.2.3')).toBe(0);
  });

  it('returns 0 for an empty string', () => {
    expect(compareVersions('', '1.2.3')).toBe(0);
  });

  it('returns 0 when neither side can be parsed', () => {
    expect(compareVersions('unknown', 'also-unknown')).toBe(0);
  });

  // A prerelease of the version you are already on is not an update, in either
  // direction: `getUpdateInfo` treats anything greater than the running version
  // as available, so this must stay at 0.
  it('never reports a prerelease of the running version as an update', () => {
    expect(compareVersions('1.2.3-rc.1', '1.2.3')).toBe(0);
    expect(compareVersions('1.2.3', '1.2.3-rc.1')).toBe(0);
  });
});
