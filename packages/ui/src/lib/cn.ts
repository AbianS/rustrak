import { type ClassValue, clsx } from 'clsx';
import { twMerge } from './tw-merge';

/**
 * Joins conditional classes and resolves Tailwind conflicts against this
 * package's token scale. It is the only sanctioned way to merge an incoming
 * `className` with a component's own.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
