/**
 * Copies text to the clipboard, returning whether it succeeded.
 *
 * `navigator.clipboard` is only available in secure contexts (HTTPS or
 * localhost). Self-hosted Rustrak may run over plain HTTP, so this never throws
 * — callers can fall back to showing the text for manual copying.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  return false;
}
