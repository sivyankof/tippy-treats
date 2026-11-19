import type { BrowserInfo } from '../../util/browser-info';
import { PERF_BUDGET, PERF_SEGMENTS, type PerfSegmentDef } from '../../data/debug/perf';

/** The share of frames at or below the returned value (nearest rank), `share` in 0..1; `sorted` is ascending. */
export function percentile(sorted: ArrayLike<number>, share: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * share) - 1));
  return sorted[index] ?? 0;
}

/** What the benchmark reports for one segment. */
export interface SegmentStats {
  id: string;
  /** Frames in the measured window. */
  frames: number;
  /** Work time of a frame (update plus render, CPU), ms. */
  meanMs: number;
  p95Ms: number;
  worstMs: number;
  /** Time between the ends of two consecutive frames, ms (a GPU-bound phone shows it here while the work time stays low). */
  intervalMeanMs: number;
  intervalP95Ms: number;
  /** Draw calls per frame, `null` when they could not be counted. */
  drawCallsMean: number | null;
  /** Length of the window by the clock, ms. */
  wallMs: number;
  /** Frames per second the window really ran at. */
  fps: number;
  /** Something the reader should know (the run ended early, the segment timed out). */
  note: string;
  /** The frames while two zones cross-fade; `null` when the window saw no zone change. */
  fade?: FadeStats | null;
}

/** The frames of a window while the backdrop cross-fades from one zone into the next. */
export interface FadeStats {
  frames: number;
  /** Most draw calls of one of them, `null` when they could not be counted. */
  drawsMax: number | null;
  /** Worst work time of one of them, ms. */
  worstMs: number;
}

const INITIAL_CAPACITY = 4096;

/** Collects the frames of one measured window. */
export class SegmentSamples {
  private work = new Float64Array(INITIAL_CAPACITY);
  /** Gap before each frame but the first of the window (`count - 1` values). */
  private gaps = new Float64Array(INITIAL_CAPACITY);
  private count = 0;
  private draws = 0;
  private drawsKnown = true;
  private startMs: number | null = null;
  private endMs = 0;
  private fadeFrames = 0;
  private fadeDrawsMax = 0;
  private fadeDrawsKnown = true;
  private fadeWorstMs = 0;

  /**
   * One frame: its work time, the draw calls it made (`null`: not counted), the time it ended at and
   * whether two zones were cross-fading in it.
   */
  add(workMs: number, drawCalls: number | null, nowMs: number, fading = false): void {
    if (fading) {
      this.fadeFrames++;
      this.fadeWorstMs = Math.max(this.fadeWorstMs, workMs);
      if (drawCalls === null) this.fadeDrawsKnown = false;
      else this.fadeDrawsMax = Math.max(this.fadeDrawsMax, drawCalls);
    }
    if (this.count === this.work.length) {
      const bigger = new Float64Array(this.work.length * 2);
      bigger.set(this.work);
      this.work = bigger;
      const biggerGaps = new Float64Array(this.gaps.length * 2);
      biggerGaps.set(this.gaps);
      this.gaps = biggerGaps;
    }
    if (this.startMs !== null) this.gaps[this.count - 1] = nowMs - this.endMs;
    this.work[this.count++] = workMs;
    if (drawCalls === null) this.drawsKnown = false;
    else this.draws += drawCalls;
    this.startMs ??= nowMs;
    this.endMs = nowMs;
  }

  get frames(): number {
    return this.count;
  }

  summary(id: string, p95Share: number, note = ''): SegmentStats {
    const sorted = this.work.slice(0, this.count).sort();
    let sum = 0;
    for (const value of sorted) sum += value;
    const gaps = this.gaps.slice(0, Math.max(0, this.count - 1)).sort();
    let gapSum = 0;
    for (const value of gaps) gapSum += value;
    const wallMs = this.startMs === null ? 0 : this.endMs - this.startMs;
    return {
      id,
      frames: this.count,
      meanMs: this.count === 0 ? 0 : sum / this.count,
      p95Ms: percentile(sorted, p95Share),
      worstMs: sorted[this.count - 1] ?? 0,
      intervalMeanMs: gaps.length === 0 ? 0 : gapSum / gaps.length,
      intervalP95Ms: percentile(gaps, p95Share),
      drawCallsMean: this.drawsKnown && this.count > 0 ? this.draws / this.count : null,
      wallMs,
      fps: wallMs > 0 ? ((this.count - 1) * 1000) / wallMs : 0,
      note,
      fade:
        this.fadeFrames === 0
          ? null
          : {
              frames: this.fadeFrames,
              drawsMax: this.fadeDrawsKnown ? this.fadeDrawsMax : null,
              worstMs: this.fadeWorstMs,
            },
    };
  }
}

/** The values of a row that are over the frame budget. */
export interface BudgetOver {
  draws: boolean;
  mean: boolean;
  worst: boolean;
  interval: boolean;
  /** A frame of the zone cross-fade drew more than `PERF_BUDGET.fadeDrawsMax`. */
  fadeDraws: boolean;
}

/** What a benchmark says about the budget as a whole. */
export interface BudgetVerdict {
  ok: boolean;
  /** Ids of the segments with something over the budget. */
  over: string[];
}

function segmentDef(id: string): PerfSegmentDef | undefined {
  return PERF_SEGMENTS.find((segment) => segment.id === id);
}

/** Draw call limit of a segment by its class; a segment the data does not know is held to the heavy one. */
function drawLimit(id: string): number {
  return PERF_BUDGET.drawCalls[segmentDef(id)?.drawClass ?? 'heavy'];
}

/** Worst frame limit of a segment: its own when it has one, the budget's otherwise. */
function worstLimit(id: string): number {
  return segmentDef(id)?.workWorstMs ?? PERF_BUDGET.workWorstMs;
}

/** What the shared atlas reached over a benchmark. */
export interface AtlasPeak {
  pages: number;
  /** Share of the page height the shelves reached at the peak. */
  usedShare: number;
}

/** True when the atlas stayed on one page and kept at least `PERF_BUDGET.atlasMinSpare` of its height free at the peak. */
export function atlasOk(peak: AtlasPeak): boolean {
  return peak.pages <= 1 && 1 - peak.usedShare >= PERF_BUDGET.atlasMinSpare;
}

/** The atlas part of the header: `atlas=pages:1 peak:0.78 spare:0.22`, with `!` when over the budget. */
export function formatAtlas(peak: AtlasPeak): string {
  const spare = (1 - peak.usedShare).toFixed(2);
  const text = `atlas=pages:${peak.pages} peak:${peak.usedShare.toFixed(2)} spare:${spare}`;
  return atlasOk(peak) ? text : `${text}!`;
}

const PHONE_UA = /iPhone|iPad|iPod|Android/i;
const DESKTOP_PLATFORM = /^(Win|Linux( x86| i\d|$)|Mac|Chrome OS|CrOS)/i;

export type { BrowserInfo };

/**
 * True in a headless, driven or emulated browser: its frame intervals jitter and say nothing about
 * a phone. Besides `webdriver` and a headless user agent, a phone user agent on a desktop platform
 * or on a screen without touch points is a desktop browser pretending (devtools emulation).
 */
export function isAutomatedBrowser(nav: BrowserInfo): boolean {
  const ua = nav.userAgent ?? '';
  if (nav.webdriver === true || /HeadlessChrome/i.test(ua)) return true;
  if (!PHONE_UA.test(ua)) return false;
  const platform = nav.userAgentData?.platform ?? nav.platform ?? '';
  if (DESKTOP_PLATFORM.test(platform)) return true;
  return nav.maxTouchPoints === 0;
}

/**
 * Which values of a row are over the budget (no draw call count: nothing to compare there). In an
 * automated browser the interval is for reference only and never counts as over.
 */
export function budgetOver(row: SegmentStats, automated = false): BudgetOver {
  return {
    draws: row.drawCallsMean !== null && row.drawCallsMean > drawLimit(row.id),
    mean: row.meanMs > PERF_BUDGET.workMeanMs,
    worst: row.worstMs > worstLimit(row.id),
    interval: !automated && row.intervalMeanMs > PERF_BUDGET.intervalMeanMs,
    fadeDraws: (row.fade?.drawsMax ?? 0) > PERF_BUDGET.fadeDrawsMax,
  };
}

export function budgetVerdict(rows: readonly SegmentStats[], automated = false): BudgetVerdict {
  const over = rows
    .filter((row) => Object.values(budgetOver(row, automated)).some(Boolean))
    .map((row) => row.id);
  return { ok: over.length === 0, over };
}

/** The line under the table: `budget: ok` or `budget: over in N segments (id, id)`. */
export function formatBudgetLine(verdict: BudgetVerdict): string {
  if (verdict.ok) return 'budget: ok';
  const count = verdict.over.length;
  return `budget: over in ${count} segment${count === 1 ? '' : 's'} (${verdict.over.join(', ')})`;
}

/** The result table as markdown (the console and the overlay show it as it is). Values over the budget end in `!`. */
export function formatTable(
  rows: readonly SegmentStats[],
  decimals: number,
  automated = false,
): string {
  const lines = [
    '| segment | mean ms | p95 ms | worst ms | interval mean ms | interval p95 ms | frames | draws/frame | fps | note |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const row of rows) {
    const over = budgetOver(row, automated);
    const mark = (text: string, flag: boolean): string => (flag ? `${text}!` : text);
    const draws = row.drawCallsMean === null ? '-' : row.drawCallsMean.toFixed(1);
    const id = Object.values(over).some(Boolean) ? `${row.id} !` : row.id;
    const note = [fadeNote(row.fade, decimals, over.fadeDraws), row.note]
      .filter((part) => part !== '')
      .join(', ');
    lines.push(
      `| ${id} | ${mark(row.meanMs.toFixed(decimals), over.mean)} | ${row.p95Ms.toFixed(decimals)} | ${mark(row.worstMs.toFixed(decimals), over.worst)} | ${mark(row.intervalMeanMs.toFixed(decimals), over.interval)} | ${row.intervalP95Ms.toFixed(decimals)} | ${row.frames} | ${mark(draws, over.draws)} | ${row.fps.toFixed(1)} | ${note} |`,
    );
  }
  return lines.join('\n');
}

/** The note of a window with a zone cross-fade: `fade N frames, draws max D, worst W ms` (`!` after a value over the budget). */
function fadeNote(fade: FadeStats | null | undefined, decimals: number, over: boolean): string {
  if (!fade) return '';
  const draws = fade.drawsMax === null ? '-' : `${fade.drawsMax}${over ? '!' : ''}`;
  return `fade ${fade.frames} frames, draws max ${draws}, worst ${fade.worstMs.toFixed(decimals)} ms`;
}

/** What a benchmark was drawn on: the line above its table. */
export interface PerfHeader {
  fx: string;
  /** Backing store of the canvas, pixels. */
  canvas: { width: number; height: number };
  /** Size of the canvas on the page, CSS pixels. */
  css: { width: number; height: number };
  devicePixelRatio: number;
  /** The density cap in force: `&dpr=`, or the cap of the effects level (`densityCapForLevel`) without it. */
  densityCap: number | null;
  /** Texture units a batch may use, and the most the device has. */
  textureUnits: number;
  maxTextureUnits: number;
  /** Parts not drawn (`&nobg` and the like). */
  hidden: readonly string[];
  /** Automated browser: the frame intervals are printed for reference and do not count. */
  automated: boolean;
  /** Weather and start place of the runs (`&weather=`, `&place=`); absent leaves them out of the line. */
  look?: { weather: string; place: string };
}

/** One line: effects level, canvas and CSS size, density, texture units and the hidden parts. */
export function formatHeader(header: PerfHeader): string {
  const { canvas, css } = header;
  const density = css.width > 0 ? canvas.width / css.width : 0;
  const hidden =
    header.hidden.length > 0 ? header.hidden.map((part) => `no${part}`).join(',') : '-';
  return [
    `fx=${header.fx}`,
    `canvas=${canvas.width}x${canvas.height}px`,
    `css=${Math.round(css.width)}x${Math.round(css.height)}`,
    `dpr=${header.devicePixelRatio}`,
    `density=${density.toFixed(2)}`,
    `cap=${header.densityCap ?? '-'}`,
    `units=${header.textureUnits}/${header.maxTextureUnits}`,
    `hidden=${hidden}`,
    ...(header.look ? [`weather=${header.look.weather}`, `place=${header.look.place}`] : []),
    header.automated ? 'intervals: reference (automated)' : 'intervals: counted (device)',
  ].join(' ');
}

/** One line of the big summary at the end of a benchmark: the values the owner reads off the phone. */
export interface SummaryRow {
  id: string;
  /** Draw calls per frame, `-` when they could not be counted. */
  draws: string;
  /** Worst frame work time, ms. */
  worst: string;
  /** Frames per second the window ran at. */
  fps: string;
  /** Which of them are over the budget; `any` is true when anything in the row is (the fade and the mean included). */
  over: { draws: boolean; worst: boolean; fps: boolean; any: boolean };
}

/**
 * The big summary of a benchmark: per segment the draws, the worst frame and the frame rate, with
 * the values over the budget flagged. The fps column is flagged by the interval budget, so in an
 * automated browser it is never over.
 */
export function summaryRows(
  rows: readonly SegmentStats[],
  decimals: number,
  automated = false,
): SummaryRow[] {
  return rows.map((row) => {
    const over = budgetOver(row, automated);
    return {
      id: row.id,
      draws: row.drawCallsMean === null ? '-' : row.drawCallsMean.toFixed(decimals),
      worst: row.worstMs.toFixed(decimals),
      fps: row.fps.toFixed(decimals),
      over: {
        draws: over.draws || over.fadeDraws,
        worst: over.worst,
        fps: over.interval,
        any: Object.values(over).some(Boolean),
      },
    };
  });
}
