export interface UpdateInfo {
  current: string;
  latest: string;
  description: string;
  url: string;
}

export function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

function parse(version: string): [number, number, number] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(normalizeVersion(version));
  if (!match) return null;
  const [, major, minor, patch] = match;
  return [Number(major), Number(minor), Number(patch)];
}

/**
 * Compares two semver-ish strings, tolerating a leading `v`.
 *
 * Returns 0 when either side cannot be parsed, so an unrecognized version can
 * never be mistaken for an available update.
 */
export function compareVersions(a: string, b: string): number {
  const left = parse(a);
  const right = parse(b);
  if (!left || !right) return 0;

  const [leftMajor, leftMinor, leftPatch] = left;
  const [rightMajor, rightMinor, rightPatch] = right;

  if (leftMajor !== rightMajor) return leftMajor < rightMajor ? -1 : 1;
  if (leftMinor !== rightMinor) return leftMinor < rightMinor ? -1 : 1;
  if (leftPatch !== rightPatch) return leftPatch < rightPatch ? -1 : 1;
  return 0;
}
