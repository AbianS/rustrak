/**
 * One easing curve and one duration scale for the entire landing. Motion reads
 * as designed rather than assembled when every element decelerates the same
 * way; mixing curves per section is what makes a page feel like a pile of
 * effects. Slow on purpose — the page is meant to feel spacious.
 */
export const EASE = [0.16, 1, 0.3, 1] as const;

export const DUR = {
  fast: 0.6,
  base: 1,
  slow: 1.5,
} as const;

export const STAGGER = 0.09;
