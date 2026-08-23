import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import { tv, type VariantProps } from '../../lib/tv';

/**
 * Who or what something belongs to.
 *
 * Two shapes, and the shape is the taxonomy rather than a style choice:
 *
 *   circle  a person -- the account in the topbar, an assignee, a member row.
 *           Initials are set in the prose face, because a name is prose.
 *   square  a thing -- the project tile, with its platform code inside. Set in
 *           mono, because `JS`, `PY`, `RS` are identifiers the system chose,
 *           not a name somebody typed.
 *
 * The fallback is not a placeholder for a missing photo, it is the normal
 * state: this product has no avatar upload and never will. A photo, when one
 * arrives from an identity provider, is the exception.
 */
const avatar = tv({
  slots: {
    root: [
      'relative flex shrink-0 select-none items-center justify-center',
      'overflow-hidden bg-surface-chip text-fg-secondary uppercase',
    ],
    image: 'size-full object-cover',
    fallback: 'leading-none',
  },
  variants: {
    shape: {
      circle: { root: 'rounded-pill font-sans' },
      square: { root: 'font-mono' },
    },
    size: {
      sm: { root: 'size-avatar text-hint', fallback: 'font-semibold' },
      md: { root: 'size-avatar-lg text-hint', fallback: 'font-semibold' },
    },
  },
  compoundVariants: [
    { shape: 'square', size: 'sm', class: { root: 'rounded-sm' } },
    { shape: 'square', size: 'md', class: { root: 'rounded-md' } },
  ],
  defaultVariants: { shape: 'circle', size: 'sm' },
});

export type AvatarShape = NonNullable<VariantProps<typeof avatar>['shape']>;

export interface AvatarProps extends VariantProps<typeof avatar> {
  /**
   * A person's name, or a project's. What is drawn is the initials; what is
   * announced is nothing -- an avatar sits beside the name it belongs to on
   * every screen that has one, so announcing it repeats the row.
   */
  name: string;
  /** Overrides the derived initials: a platform code, a two-letter tag. */
  initials?: string;
  src?: string;
  className?: string;
}

/**
 * Two initials at most. Three is the width of a word and stops reading as a
 * monogram; one is ambiguous the moment a team has two people called Ana.
 */
function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return (words[0] ?? '').slice(0, 2);
  return `${words[0]?.[0] ?? ''}${words[1]?.[0] ?? ''}`;
}

export function Avatar({
  name,
  initials,
  src,
  shape,
  size,
  className,
}: AvatarProps) {
  const styles = avatar({ shape, size });

  return (
    <BaseAvatar.Root aria-hidden="true" className={styles.root({ className })}>
      {src ? (
        <BaseAvatar.Image src={src} alt="" className={styles.image()} />
      ) : null}
      <BaseAvatar.Fallback className={styles.fallback()}>
        {initials ?? initialsFrom(name)}
      </BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}

Avatar.displayName = 'Avatar';
