import { createTV } from 'tailwind-variants';
import { twMergeConfig } from './tw-merge';

/**
 * `tv` is the only way to describe how a component looks. Each recipe declares
 * its variants and, when the component has several parts, its slots.
 *
 * House rules for writing one:
 *
 *   - only token-backed utilities (`bg-surface`, `h-control-md`,
 *     `text-control`). Never `bg-[#16161a]`, `h-[34px]` or `text-[13px]`;
 *   - state is read from the attributes Base UI exposes (`data-pressed:`,
 *     `data-disabled:`), not from props threaded through by hand;
 *   - a control's hairline uses `inset-ring`, never `border`. See the borders
 *     note in `styles/tokens.css`;
 *   - focus always through the system's `focusRing` constant.
 */
export const tv = createTV({ twMergeConfig });

export type { VariantProps } from 'tailwind-variants';
