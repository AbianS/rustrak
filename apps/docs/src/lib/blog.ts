import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import readingTime from 'reading-time';

export type Post = {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  image?: string;
  readingTime: string;
  draft: boolean;
};

const POSTS_DIR = path.join(process.cwd(), 'content/blog');

function ensurePostsDir() {
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
}

export function getPosts(): Post[] {
  ensurePostsDir();
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.mdx'))
    .map((filename) => {
      const raw = fs.readFileSync(path.join(POSTS_DIR, filename), 'utf-8');
      const { data, content } = matter(raw);
      return {
        slug: filename.replace('.mdx', ''),
        title: data.title ?? 'Untitled',
        description: data.description ?? '',
        date: data.date ?? new Date().toISOString().split('T')[0],
        author: data.author ?? 'Rustrak Team',
        tags: Array.isArray(data.tags) ? data.tags : [],
        image: data.image,
        readingTime: readingTime(content).text,
        draft: data.draft ?? false,
      };
    })
    .filter((p) => process.env.NODE_ENV === 'development' || !p.draft)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPost(slug: string): { post: Post; content: string } | null {
  ensurePostsDir();
  const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);
  const post: Post = {
    slug,
    title: data.title ?? 'Untitled',
    description: data.description ?? '',
    date: data.date ?? new Date().toISOString().split('T')[0],
    author: data.author ?? 'Rustrak Team',
    tags: Array.isArray(data.tags) ? data.tags : [],
    image: data.image,
    readingTime: readingTime(content).text,
    draft: data.draft ?? false,
  };
  return { post, content };
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
