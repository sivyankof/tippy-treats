/**
 * Puts the text on the clipboard: the Clipboard API where the page may use it, a selected textarea
 * and `execCommand('copy')` where it may not (Safari over plain http on the local network). When
 * both fail and `shown` is given, that element is shown and its text selected for a manual copy.
 * True when copied. Call it inside the tap: the old way must run before any await.
 */
export async function copyText(text: string, shown?: HTMLElement): Promise<boolean> {
  // Over plain http the API is missing; the old way must run inside the tap, before any await.
  if (!window.isSecureContext || !('clipboard' in navigator)) return copyBySelection(text, shown);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyBySelection(text, shown);
  }
}

function copyBySelection(text: string, shown: HTMLElement | undefined): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.readOnly = true;
  area.style.cssText = 'position:fixed;left:0;top:0;opacity:0;font-size:16px;';
  document.body.appendChild(area);
  area.focus();
  area.setSelectionRange(0, text.length);
  let copied: boolean;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  if (!copied && shown) selectForManualCopy(shown);
  return copied;
}

function selectForManualCopy(shown: HTMLElement): void {
  shown.style.display = 'block';
  const range = document.createRange();
  range.selectNodeContents(shown);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}
