import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export type Release = {
  slug: string;
  version: string;
  title: string;
  description: string;
  date: string;
  tags: string[];
  content: string;
};

const CHANGELOG_DIR = path.join(process.cwd(), 'content/changelog');

function ensureDir() {
  if (!fs.existsSync(CHANGELOG_DIR))
    fs.mkdirSync(CHANGELOG_DIR, { recursive: true });
}

function safeDate(s: string): Date | null {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function getReleases(): Release[] {
  ensureDir();
  return fs
    .readdirSync(CHANGELOG_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((filename) => {
      const raw = fs.readFileSync(path.join(CHANGELOG_DIR, filename), 'utf-8');
      const { data, content } = matter(raw);
      return {
        slug: filename.replace(/\.mdx$/, ''),
        version: data.version ?? '',
        title: data.title ?? 'Untitled',
        description: data.description ?? '',
        date:
          data.date instanceof Date
            ? data.date.toISOString().split('T')[0]
            : String(data.date ?? new Date().toISOString().split('T')[0]),
        tags: Array.isArray(data.tags) ? data.tags : [],
        content: content.trim(),
      };
    })
    .sort(
      (a, b) =>
        (safeDate(b.date)?.getTime() ?? 0) - (safeDate(a.date)?.getTime() ?? 0),
    );
}

export function formatDateShort(dateStr: string): string {
  const d = safeDate(dateStr);
  if (!d) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
