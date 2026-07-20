/**
 * Mirrors `VALID_PLATFORMS` in `apps/server/src/models/project.rs` exactly —
 * keep both lists in sync. Coarse language-level platform ids only (e.g.
 * "javascript", not "javascript-nextjs"), matching what Rustrak's
 * auto-detection and manual override both accept.
 */
export const VALID_PLATFORMS = [
  'as3',
  'c',
  'cfml',
  'cocoa',
  'csharp',
  'elixir',
  'go',
  'groovy',
  'haskell',
  'java',
  'javascript',
  'native',
  'node',
  'objc',
  'other',
  'perl',
  'php',
  'python',
  'ruby',
] as const;

export type ValidPlatform = (typeof VALID_PLATFORMS)[number];

const PLATFORM_LABELS: Record<ValidPlatform, string> = {
  as3: 'ActionScript',
  c: 'C',
  cfml: 'CFML',
  cocoa: 'Cocoa',
  csharp: 'C#',
  elixir: 'Elixir',
  go: 'Go',
  groovy: 'Groovy',
  haskell: 'Haskell',
  java: 'Java',
  javascript: 'JavaScript',
  native: 'Native',
  node: 'Node.js',
  objc: 'Objective-C',
  other: 'Other',
  perl: 'Perl',
  php: 'PHP',
  python: 'Python',
  ruby: 'Ruby',
};

export function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform as ValidPlatform] ?? platform;
}
