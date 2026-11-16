import { PERF_BUDGET, PERF_SEGMENTS } from '../../data/perf';

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

  /** One frame: its work time, the draw calls it made (`null`: not counted) and the time it ended at. */
  add(workMs: number, drawCalls: number | null, nowMs: number): void {
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
    };
  }
}

/** The values of a row that are over the frame budget. */
export interface BudgetOver {
  draws: boolean;
  mean: boolean;
  worst: boolean;
  interval: boolean;
}

/** What a benchmark says about the budget as a whole. */
export interface BudgetVerdict {
  ok: boolean;
  /** Ids of the segments with something over the budget. */
  over: string[];
}

/** Draw call limit of a segment by its class; a segment the data does not know is held to the heavy one. */
function drawLimit(id: string): number {
  const def = PERF_SEGMENTS.find((segment) => segment.id === id);
  return PERF_BUDGET.drawCalls[def?.drawClass ?? 'heavy'];
}

/** True in a headless or driven browser: its frame intervals jitter and say nothing about a phone. */
export function isAutomatedBrowser(nav: { webdriver?: boolean; userAgent?: string }): boolean {
  return nav.webdriver === true || /HeadlessChrome/i.test(nav.userAgent ?? '');
}

/**
 * Which values of a row are over the budget (no draw call count: nothing to compare there). In an
 * automated browser the interval is for reference only and never counts as over.
 */
export function budgetOver(row: SegmentStats, automated = false): BudgetOver {
  return {
    draws: row.drawCallsMean !== null && row.drawCallsMean > drawLimit(row.id),
    mean: row.meanMs > PERF_BUDGET.workMeanMs,
    worst: row.worstMs > PERF_BUDGET.workWorstMs,
    interval: !automated && row.intervalMeanMs > PERF_BUDGET.intervalMeanMs,
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
    lines.push(
      `| ${id} | ${mark(row.meanMs.toFixed(decimals), over.mean)} | ${row.p95Ms.toFixed(decimals)} | ${mark(row.worstMs.toFixed(decimals), over.worst)} | ${mark(row.intervalMeanMs.toFixed(decimals), over.interval)} | ${row.intervalP95Ms.toFixed(decimals)} | ${row.frames} | ${mark(draws, over.draws)} | ${row.fps.toFixed(1)} | ${row.note} |`,
    );
  }
  return lines.join('\n');
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
    header.automated ? 'intervals: reference (automated)' : 'intervals: counted (device)',
  ].join(' ');
}
