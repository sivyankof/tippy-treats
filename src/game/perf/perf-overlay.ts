import { PERF } from '../../data/perf';

/**
 * The benchmark's on-screen text, a plain DOM box over the canvas (numbers and ids only, like the
 * fps meter, so no i18n): one line of progress while it runs, the result table at the end.
 */
export class PerfOverlay {
  private readonly box: HTMLPreElement;

  constructor() {
    this.box = document.createElement('pre');
    this.box.style.cssText =
      `position:fixed;z-index:${PERF.overlay.zIndex};left:0;right:0;top:0;margin:0;padding:4px;` +
      `font:${PERF.overlay.fontPx}px/1.25 monospace;color:#fff;background:rgba(0,0,0,0.55);` +
      'pointer-events:none;white-space:pre-wrap;word-break:break-all;';
    document.body.appendChild(this.box);
  }

  /** One line while the benchmark runs; it changes only between segments, so it costs the frames nothing. */
  progress(text: string): void {
    this.box.textContent = text;
  }

  /** The table of the finished benchmark. */
  table(text: string): void {
    this.box.style.background = 'rgba(0,0,0,0.8)';
    this.box.style.pointerEvents = 'auto';
    this.box.textContent = text;
  }
}
