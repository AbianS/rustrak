/**
 * Copies text to the clipboard, returning whether it succeeded.
 *
 * Uses the Clipboard API in secure contexts and falls back to the legacy
 * selection-based copy command for plain HTTP deployments.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back when browser permissions reject the Clipboard API.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    // execCommand's boolean result varies by browser, but it is the best
    // available signal when the Clipboard API is unavailable over HTTP.
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
