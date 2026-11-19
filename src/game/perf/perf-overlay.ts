import { PERF } from '../../data/debug/perf';
import { reloadWithQuery } from '../../util/page-reload';
import { overlayButtonCss } from '../debug/overlay-style';
import { copyText } from '../common/copy-text';
import { readSafeInsets } from '../app/safe-area';
import type { SummaryRow } from './perf-stats';

const { overlay } = PERF;

const BUTTON_CSS =
  overlayButtonCss(overlay.buttonFontPx, overlay.buttonPx, 'rgba(255,255,255,0.18)') +
  'margin:6px 8px 0 0;';

/** What the end of a benchmark shows: the budget line, the per-segment summary and the full text to copy. */
export interface PerfOutcome {
  /** `budget: ok` or `budget: over in N segments (…)`. */
  verdict: string;
  ok: boolean;
  rows: readonly SummaryRow[];
  /** The header and the full table, as the console prints them. */
  text: string;
}

/**
 * The benchmark's on-screen text, a plain DOM box over the canvas. Like the debug panel and the fps
 * meter it is a dev tool outside i18n: numbers, segment ids and short English labels. While it runs it is a small strip at the bottom with one line of progress;
 * at the end it grows into a big summary the owner can read off the phone (budget, draws, worst
 * frame and fps per segment) with "copy", which puts the full report on the clipboard, and "table",
 * which folds the full table out.
 */
export class PerfOverlay {
  private readonly box: HTMLDivElement;
  private readonly line: HTMLDivElement;
  private readonly body: HTMLPreElement;
  private text = '';

  constructor() {
    // The overlay keeps clear of the system bars (the insets of the screen, CSS px).
    const insets = readSafeInsets();
    this.box = document.createElement('div');
    this.box.style.cssText =
      `position:fixed;z-index:${overlay.zIndex};left:0;right:0;bottom:0;margin:0;` +
      `padding:4px 4px ${4 + insets.bottom}px;` +
      `font:${overlay.fontPx}px/1.25 monospace;color:#fff;background:rgba(0,0,0,0.55);` +
      'pointer-events:none;box-sizing:border-box;';
    this.line = document.createElement('div');
    this.body = document.createElement('pre');
    this.body.style.cssText =
      `display:none;margin:6px 0 0;max-height:${overlay.maxHeightVh}vh;overflow:auto;pointer-events:auto;touch-action:pan-y;` +
      'white-space:pre;user-select:text;-webkit-user-select:text;';
    this.box.append(this.line, this.body);
    document.body.appendChild(this.box);
  }

  /** One line while the benchmark runs; it changes only between segments, so it costs the frames nothing. */
  progress(text: string): void {
    this.line.textContent = text;
  }

  /** The finished benchmark: the big summary and the buttons, the full table folded in. */
  finish(outcome: PerfOutcome): void {
    this.text = outcome.text;
    const insets = readSafeInsets();
    this.body.textContent = outcome.text;
    this.box.style.cssText +=
      `top:0;padding:${12 + insets.top}px 16px ${12 + insets.bottom}px;overflow:auto;touch-action:pan-y;overscroll-behavior:contain;` +
      'background:rgba(0,0,0,0.93);pointer-events:auto;';
    this.line.replaceChildren(verdictLine(outcome), summaryGrid(outcome.rows));
    const buttons = document.createElement('div');
    buttons.append(
      this.button('copy', (button) => {
        void copyText(this.text, this.body).then((done) => {
          button.textContent = done ? 'copied' : 'select';
          window.setTimeout(() => (button.textContent = 'copy'), overlay.copiedMs);
        });
      }),
      this.button('back to game', () => reloadWithQuery('')),
      this.button('table', (button) => {
        const open = this.body.style.display === 'none';
        this.body.style.display = open ? 'block' : 'none';
        button.textContent = open ? 'hide' : 'table';
      }),
    );
    this.box.insertBefore(buttons, this.body);
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

function verdictLine(outcome: PerfOutcome): HTMLDivElement {
  const line = document.createElement('div');
  line.textContent = outcome.verdict;
  line.style.cssText =
    `font:bold ${overlay.verdictFontPx}px/1.2 sans-serif;margin-bottom:8px;word-break:break-word;` +
    `color:${outcome.ok ? overlay.okColor : overlay.overColor};`;
  return line;
}

/** Segment, draws, worst ms and fps in four columns; a value over the budget is red and ends in `!`. */
function summaryGrid(rows: readonly SummaryRow[]): HTMLDivElement {
  const grid = document.createElement('div');
  grid.style.cssText =
    `display:grid;grid-template-columns:1fr auto auto auto;column-gap:12px;row-gap:2px;` +
    `font:${overlay.summaryFontPx}px/1.3 monospace;`;
  const cell = (text: string, color: string, alignRight: boolean): HTMLSpanElement => {
    const span = document.createElement('span');
    span.textContent = text;
    span.style.cssText = `color:${color};${alignRight ? 'text-align:right;' : ''}white-space:nowrap;`;
    return span;
  };
  for (const head of ['segment', 'draws', 'worst ms', 'fps']) {
    grid.append(cell(head, overlay.headColor, head !== 'segment'));
  }
  const value = (text: string, over: boolean): HTMLSpanElement =>
    cell(over ? `${text}!` : text, over ? overlay.overColor : '#fff', true);
  for (const row of rows) {
    grid.append(
      cell(row.over.any ? `${row.id} !` : row.id, row.over.any ? overlay.overColor : '#fff', false),
      value(row.draws, row.over.draws),
      value(row.worst, row.over.worst),
      value(row.fps, row.over.fps),
    );
  }
  return grid;
}
