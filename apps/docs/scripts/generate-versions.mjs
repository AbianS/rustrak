import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHANGELOG_DIR = path.join(ROOT, 'content/changelog');
const OUTPUT = path.join(ROOT, 'public/versions.json');
const CHANGELOG_URL = 'https://rustrak.github.io/rustrak/changelog';

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateString(value) {
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value ?? '');
}

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(value);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

// Ordered by version, not by date: a backported patch can carry a later date
// than the minor that supersedes it, and the filename prefixes stop sorting
// lexicographically once they reach three digits. Date and slug only break
// ties between equal versions.
function byNewestFirst(a, b) {
  const left = parseVersion(a.version);
  const right = parseVersion(b.version);

  if (left && right) {
    for (let i = 0; i < 3; i += 1) {
      if (left[i] !== right[i]) return right[i] - left[i];
    }
  } else if (left || right) {
    // An unparseable version can never be the latest release, so it sinks.
    return left ? -1 : 1;
  }

  const byDate =
    (safeDate(b.date)?.getTime() ?? 0) - (safeDate(a.date)?.getTime() ?? 0);
  if (byDate !== 0) return byDate;
  return b.slug.localeCompare(a.slug);
}

function readReleases() {
  return fs
    .readdirSync(CHANGELOG_DIR)
    .filter((filename) => filename.endsWith('.mdx'))
    .map((filename) => {
      const raw = fs.readFileSync(path.join(CHANGELOG_DIR, filename), 'utf-8');
      const { data } = matter(raw);
      const slug = filename.replace(/\.mdx$/, '');
      return {
        slug,
        version: String(data.version ?? '').replace(/^v/, ''),
        title: data.title ?? 'Untitled',
        description: data.description ?? '',
        date: toDateString(data.date),
        url: `${CHANGELOG_URL}#${slug}`,
      };
    })
    .filter((release) => release.version !== '')
    .sort(byNewestFirst)
    .map(({ slug: _slug, ...release }) => release);
}

const versions = readReleases();
const payload = { latest: versions[0]?.version ?? null, versions };

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify(payload, null, 2)}\n`);

console.log(
  `versions.json: ${versions.length} releases, latest ${payload.latest}`,
);
