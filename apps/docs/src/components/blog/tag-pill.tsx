import Link from 'next/link';
import { cn } from '@/lib/utils';

type TagPillProps = {
  tag: string;
  href?: string;
  className?: string;
};

/**
 * A tag, set in mono like everything else on these pages that is metadata
 * rather than prose. It reads as a label attached to the entry instead of as
 * another sentence competing with the description above it — and it is the
 * same chip the changelog uses, so a reader moving between the two pages meets
 * one language rather than two.
 */
export function TagPill({ tag, href, className }: TagPillProps) {
  const classes = cn(
    'inline-flex items-center rounded-sm bg-foreground/[0.055] px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors',
    href && 'hover:bg-primary/10 hover:text-primary',
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
