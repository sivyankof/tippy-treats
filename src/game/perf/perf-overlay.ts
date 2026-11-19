import { PERF } from '../../data/debug/perf';

const BUTTON_CSS =
  'pointer-events:auto;font:inherit;margin-left:6px;padding:2px 8px;border:1px solid #fff;' +
  'border-radius:4px;color:#fff;background:rgba(255,255,255,0.15);';

/**
 * The benchmark's on-screen text, a plain DOM box over the canvas (numbers and ids only, like the
 * fps meter, so no i18n). It stays a small strip at the bottom: one line of progress while it runs;
 * at the end the table folds out with "table" and goes to the clipboard with "copy".
 */
export class PerfOverlay {
  private readonly box: HTMLDivElement;
  private readonly line: HTMLSpanElement;
  private readonly body: HTMLPreElement;
  private text = '';

  constructor() {
    const { zIndex, fontPx, maxHeightVh } = PERF.overlay;
    this.box = document.createElement('div');
    this.box.style.cssText =
      `position:fixed;z-index:${zIndex};left:0;bottom:0;max-width:100%;margin:0;padding:4px;` +
      `font:${fontPx}px/1.25 monospace;color:#fff;background:rgba(0,0,0,0.55);pointer-events:none;`;
    this.line = document.createElement('span');
    this.body = document.createElement('pre');
    this.body.style.cssText =
      `display:none;margin:4px 0 0;max-height:${maxHeightVh}vh;overflow:auto;pointer-events:auto;` +
      'white-space:pre-wrap;word-break:break-all;user-select:text;-webkit-user-select:text;';
    this.box.append(this.line, this.body);
    document.body.appendChild(this.box);
  }

  /** One line while the benchmark runs; it changes only between segments, so it costs the frames nothing. */
  progress(text: string): void {
    this.line.textContent = text;
  }

  /** The finished benchmark: a short line with the buttons, the table folded in. */
  table(summary: string, text: string): void {
    this.text = text;
    this.line.textContent = summary;
    this.body.textContent = text;
    this.box.style.background = 'rgba(0,0,0,0.8)';
    this.box.insertBefore(
      this.button('table', (button) => {
        const open = this.body.style.display === 'none';
        this.body.style.display = open ? 'block' : 'none';
        button.textContent = open ? 'hide' : 'table';
      }),
      this.body,
    );
    this.box.insertBefore(
      this.button('copy', (button) => {
        void copyText(this.text, this.body).then((done) => {
          button.textContent = done ? 'copied' : 'select';
          window.setTimeout(() => (button.textContent = 'copy'), PERF.overlay.copiedMs);
        });
      }),
      this.body,
    );
  }

  private button(label: string, onTap: (button: HTMLButtonElement) => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = BUTTON_CSS;
    button.addEventListener('click', () => onTap(button));
    return button;
  }
}

/**
 * Puts the text on the clipboard: the Clipboard API where the page may use it, a selected textarea
 * and `execCommand('copy')` where it may not (Safari over plain http on the local network). When
 * both fail the table is left open and selected on the screen for a manual copy. True when copied.
 */
async function copyText(text: string, shown: HTMLElement): Promise<boolean> {
  // Over plain http the API is missing; the old way must run inside the tap, before any await.
  if (!window.isSecureContext || !('clipboard' in navigator)) return copyBySelection(text, shown);
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyBySelection(text, shown);
  }
}

function copyBySelection(text: string, shown: HTMLElement): boolean {
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
  if (!copied) {
    shown.style.display = 'block';
    const range = document.createRange();
    range.selectNodeContents(shown);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
  return copied;
}
