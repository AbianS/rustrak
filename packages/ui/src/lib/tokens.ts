/**
 * TypeScript mirror of the names published in `styles/tokens.css`.
 *
 * tailwind-merge cannot read the CSS, so it needs this list to know that
 * `text-control` is a font size and `text-fg-muted` a colour. Without it a
 * class passed through `className` does not override the component's own.
 *
 * `tokens.test.ts` compares both files and fails when they drift apart.
 */

export const colorTokens = [
  'transparent',
  'current',
  'inherit',
  'canvas',
  'surface',
  'surface-subtle',
  'surface-sunken',
  'surface-raised',
  'surface-hover',
  'surface-active',
  'surface-selected',
  'surface-disabled',
  'surface-floating',
  'surface-brand',
  'surface-brand-hover',
  'surface-fatal',
  'surface-error',
  'surface-warning',
  'surface-info',
  'surface-debug',
  'border',
  'border-subtle',
  'border-strong',
  'border-control',
  'border-raised',
  'border-brand',
  'border-danger',
  'border-on-brand',
  'fg',
  'fg-secondary',
  'fg-tertiary',
  'fg-muted',
  'fg-subtle',
  'fg-ghost',
  'fg-disabled',
  'fg-brand',
  'fg-on-brand',
  'fg-fatal',
  'fg-error',
  'fg-warning',
  'fg-info',
  'fg-debug',
  'fg-success',
  'ring',
  'scrim',
] as const;

export const textTokens = [
  'page-title',
  'section',
  'body',
  'control',
  'control-sm',
  'meta',
  'label',
  'overline',
  'badge',
  'column',
  'tag',
  'code',
] as const;

export const spacingTokens = [
  'control-sm',
  'control-md',
  'control-lg',
  'dot',
  'dot-sm',
  'meter',
  'icon-sm',
  'icon-md',
  'icon-lg',
] as const;

export const radiusTokens = ['xs', 'sm', 'md', 'lg', 'pill'] as const;

export const shadowTokens = ['raised', 'overlay', 'dialog'] as const;

export const fontTokens = ['sans', 'mono'] as const;

export const durationTokens = ['instant', 'fast', 'moderate', 'slow'] as const;

export const easeTokens = ['linear', 'standard', 'entrance', 'exit'] as const;
