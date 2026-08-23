import type { ReactNode } from 'react';
import { Wordmark } from '../../components/brand/wordmark';
import { Text } from '../../components/text/text';

/**
 * The page furniture, taken from the brandbook.
 *
 * Rustrak already has a house style for documentation -- `brand/brandbook` --
 * and it is a cover, numbered sections divided by a hairline, and one rule per
 * section set apart in a lime-edged block. These pages wear it, so the design
 * system and the brand book read as the same document rather than as two teams.
 *
 * All of it renders inside `<Unstyled>`: Storybook's docs stylesheet sets its
 * own container width, margins and type on bare elements, and fighting it one
 * override at a time is what makes a Storybook look like a Storybook.
 */

/** The column everything sits in. */
export function DocPage({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-6 pb-24">
      {children}
    </div>
  );
}

/**
 * The cover.
 *
 * The mark first and at a size that is not apologetic, one line saying what
 * the thing is, and a note about where the values come from. Nothing else:
 * a cover that also explains is a first section pretending to be a cover.
 */
export function Cover({
  eyebrow,
  title,
  lede,
  note,
  mark,
  children,
}: {
  eyebrow: string;
  /** Omitted on the front page, where the wordmark *is* the title. */
  title?: string;
  lede: ReactNode;
  note?: ReactNode;
  /** Draws the wordmark instead of a heading. */
  mark?: boolean;
  /** Tags, links, anything that belongs under the lede. */
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col items-start justify-center gap-6 border-border-subtle border-b py-20">
      <Text variant="column" tone="brand">
        {eyebrow}
      </Text>
      {mark ? (
        <Wordmark className="h-10 w-auto text-fg" />
      ) : (
        <Text variant="page-title" render={<h1 />} className="font-semibold">
          {title}
        </Text>
      )}
      <Text
        variant="body"
        tone="secondary"
        render={<p />}
        className="max-w-prose"
      >
        {lede}
      </Text>
      {note ? (
        <Text variant="meta" tone="meta" render={<p />} className="max-w-prose">
          {note}
        </Text>
      ) : null}
      {children ? <div className="flex flex-wrap gap-2">{children}</div> : null}
    </header>
  );
}

/**
 * A numbered section, divided from the one above it by a hairline.
 *
 * The number is not decoration: on a page this long it is what a reviewer
 * points at, and it is the reason the sections stay in a deliberate order
 * rather than growing wherever there was room.
 */
export function Section({
  n,
  title,
  intro,
  children,
}: {
  /** `01`, `02`. Written out so the page keeps its order under review. */
  n: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 border-border-subtle border-b py-16">
      <div className="flex flex-col gap-3">
        <Text variant="column" tone="meta">
          {n}
        </Text>
        <Text variant="section" render={<h2 />}>
          {title}
        </Text>
        {intro ? (
          <Text
            variant="body"
            tone="secondary"
            render={<p />}
            className="max-w-prose"
          >
            {intro}
          </Text>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A subdivision inside a section. Same rhythm, no number, no rule. */
export function Subsection({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-col gap-2">
        <Text variant="card-title" render={<h3 />}>
          {title}
        </Text>
        {intro ? (
          <Text
            variant="body"
            tone="secondary"
            render={<p />}
            className="max-w-prose"
          >
            {intro}
          </Text>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** A paragraph. Bare `<p>` inside `<Unstyled>` has no type at all. */
export function P({ children }: { children: ReactNode }) {
  return (
    <Text
      variant="body"
      tone="secondary"
      render={<p />}
      className="max-w-prose"
    >
      {children}
    </Text>
  );
}

/**
 * The one line of a section that has to survive being skimmed.
 *
 * Straight from the brandbook: a lime edge, a raised surface, and no more than
 * a sentence. If two of these end up in one section, one of them is a
 * paragraph.
 */
export function Rule({ children }: { children: ReactNode }) {
  return (
    <blockquote className="border-surface-brand border-l-2 bg-surface py-4 pl-5">
      <Text variant="value" className="max-w-prose font-medium">
        {children}
      </Text>
    </blockquote>
  );
}
