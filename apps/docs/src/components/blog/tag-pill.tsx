import Link from 'next/link';
import { cn } from '@/lib/utils';

type TagPillProps = {
  tag: string;
  href?: string;
  className?: string;
};

export function TagPill({ tag, href, className }: TagPillProps) {
  const classes = cn(
    'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
    'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
    'hover:bg-primary/10 hover:text-primary dark:hover:bg-primary/20 dark:hover:text-primary',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {tag}
      </Link>
    );
  }

  return <span className={classes}>{tag}</span>;
}
