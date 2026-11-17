import type { CreatureId } from './creatures';
import type { CutVariantName } from './cut-look';
import { MASTERY } from './mastery';

/**
 * The `?perf=1` benchmark: an automatic run through fixed scenes with a fixed seed, measuring the
 * frame work time of each (docs/08-architecture.md, section 9). Nothing of it reaches the save.
 */

/** How the layers of a segment are dropped. */
export type PerfDriverSpec =
  /** A timing bot with this deviation (ms); 1 drops (almost) every layer perfectly. */
  | { kind: 'bot'; sdMs: number }
  /** Nobody taps: the flying layer keeps bouncing between the walls. */
  | { kind: 'idle' }
  /** Taps as soon as the layer is clear of the tower (a certain miss), once armed. */
  | { kind: 'miss' }
  /** Taps when the layer is this share of its width off the tower: a cut of that size every time. */
  | { kind: 'cut'; share: number };

/** Something the director makes happen again and again during a segment. */
export type PerfTrigger =
  | { kind: 'lick'; scene: 'big' | 'short'; drop: 'run' | 'fall'; everyMs: number }
  | { kind: 'guest'; everyMs: number };

/** When the measured window of a segment opens: right after the warm-up, at the miss, or when the results screen is up. */
export type PerfStartOn = 'ready' | 'miss' | 'results';

/** Which draw call limit of `PERF.budget` a segment is held to. */
export type PerfDrawClass = 'light' | 'heavy';

export interface PerfSegmentDef {
  id: string;
  /** Light segments are quiet scenes, heavy ones carry many effects or a tall tower. */
  drawClass: PerfDrawClass;
  /** Layers already placed (a checkpoint height takes the checkpoint width). */
  start: number;
  team: ReadonlyArray<CreatureId | null>;
  level: number;
  driver: PerfDriverSpec;
  trigger?: PerfTrigger;
  /** Every cut of the segment is forced to this variant. */
  cutVariant?: CutVariantName;
  /** Unmeasured time from the moment the run is ready (the camera has risen). */
  warmupMs: number;
  /** Length of the measured window. */
  measureMs: number;
  startOn: PerfStartOn;
  /** The window also closes when the results screen opens (the collapse). */
  endOnResults?: boolean;
}

const NO_TEAM: ReadonlyArray<CreatureId | null> = [null, null, null];

export const PERF_SEGMENTS = [
  {
    id: 'calm',
    drawClass: 'light',
    start: 0,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'bot', sdMs: 25 },
    warmupMs: 2000,
    measureMs: 10000,
    startOn: 'ready',
  },
  {
    id: 'tower',
    drawClass: 'heavy',
    start: 59,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'bot', sdMs: 12 },
    warmupMs: 2000,
    measureMs: 10000,
    startOn: 'ready',
  },
  {
    id: 'lick-big',
    drawClass: 'heavy',
    start: 30,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'idle' },
    trigger: { kind: 'lick', scene: 'big', drop: 'fall', everyMs: 150 },
    warmupMs: 1500,
    measureMs: 9000,
    startOn: 'ready',
  },
  {
    id: 'lick-short',
    drawClass: 'heavy',
    start: 30,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'idle' },
    trigger: { kind: 'lick', scene: 'short', drop: 'fall', everyMs: 150 },
    warmupMs: 1500,
    measureMs: 9000,
    startOn: 'ready',
  },
  {
    id: 'rainbow',
    drawClass: 'heavy',
    start: 53,
    team: ['rainbow', 'rainbow', 'rainbow'],
    level: 5,
    driver: { kind: 'bot', sdMs: 4 },
    warmupMs: 1500,
    measureMs: 10000,
    startOn: 'ready',
  },
  {
    id: 'edge',
    drawClass: 'light',
    start: 80,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'idle' },
    warmupMs: 1500,
    measureMs: 9000,
    startOn: 'ready',
  },
  {
    id: 'perfects',
    // Heavy since 2026-11-16 (owner): with a team its HUD texts (badge counters, the next-creature
    // chip) add ~4-5 draws; the game itself stays near 35. See docs/08, section 13.
    drawClass: 'heavy',
    start: 0,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'bot', sdMs: 1 },
    warmupMs: 5000,
    measureMs: 10000,
    startOn: 'ready',
  },
  {
    id: 'clouds',
    drawClass: 'heavy',
    start: 60,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'bot', sdMs: 6 },
    warmupMs: 2000,
    measureMs: 10000,
    startOn: 'ready',
  },
  {
    id: 'space',
    drawClass: 'heavy',
    start: 100,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'bot', sdMs: 3 },
    warmupMs: 2000,
    measureMs: 10000,
    startOn: 'ready',
  },
  {
    id: 'guest',
    drawClass: 'heavy',
    start: 40,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'bot', sdMs: 12 },
    trigger: { kind: 'guest', everyMs: 400 },
    warmupMs: 1500,
    measureMs: 10000,
    startOn: 'ready',
  },
  {
    id: 'cuts',
    drawClass: 'light',
    start: 8,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'cut', share: 0.05 },
    cutVariant: 'strands',
    warmupMs: 1500,
    measureMs: 19000,
    startOn: 'ready',
  },
  {
    id: 'collapse',
    drawClass: 'heavy',
    start: 80,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'miss' },
    warmupMs: 1500,
    measureMs: 15000,
    startOn: 'miss',
    endOnResults: true,
  },
  {
    id: 'results',
    drawClass: 'light',
    start: 80,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'miss' },
    warmupMs: 1200,
    measureMs: 8000,
    startOn: 'results',
  },
] as const satisfies readonly PerfSegmentDef[];

export type PerfSegmentId = (typeof PERF_SEGMENTS)[number]['id'];

export function isPerfSegmentId(value: string): value is PerfSegmentId {
  return PERF_SEGMENTS.some((segment) => segment.id === value);
}

/** The frame budget a segment is compared with (provisional numbers; one place to change them). */
export const PERF_BUDGET = {
  /** Draw calls per frame on average, by the class of the segment. */
  drawCalls: { light: 40, heavy: 60 } as Readonly<Record<PerfDrawClass, number>>,
  /** Mean frame work time, ms. */
  workMeanMs: 8,
  /** Worst frame work time, ms. */
  workWorstMs: 50,
  /** Mean time between frames, ms (about 55 fps). */
  intervalMeanMs: 18,
} as const;

/** The knobs of the benchmark that are not per segment. */
export const PERF = {
  /** The frame budget (see `PERF_BUDGET`). */
  budget: PERF_BUDGET,
  /** Share of frames at or below the "p95" column. */
  percentile: 0.95,
  /** Run seed of every segment: the same tower, layers and looks on every machine. */
  seed: 20261115,
  /** How long the director waits for a run to become ready, or for the results screen, before it gives up on the segment. */
  readyTimeoutMs: 15000,
  /** `&still=` names: each one plays that segment and freezes the game at a fixed point. */
  stills: { tower: 'tower', tongue: 'lick-big', arc: 'rainbow' } as Readonly<
    Record<string, PerfSegmentId>
  >,
  /** The freeze of a still comes this long after its moment (the tower: after the run is ready, before the first landing, so no cloud of the Clouds zone hides the layer). */
  stillSettleMs: 300,
  towerStillMs: 600,
  /** The results screen of the benchmark shows a fresh oven: what its summary claims. */
  results: { xpGained: 3, oven: { fresh: 6, left: 14, ranOut: false } },
  /** The table overlay: a small box at the bottom, the table folds out of it. */
  overlay: { zIndex: 99999, fontPx: 11, decimals: 2, maxHeightVh: 60, copiedMs: 1500 },
  /** `&mastery=on|off`: the team of the segments that have none (the creatures with a moving accent), at the grown level or one below it. */
  mastery: {
    team: ['honey', 'frosty', 'sprinkle'] as readonly CreatureId[],
    levelOn: MASTERY.lookLevel,
    levelOff: MASTERY.lookLevel - 1,
    /** `&mastery=master`: the master level, where the master effects and their captions act. */
    levelMaster: MASTERY.masterLevel,
  },
  /** `&dpr=`: the render densities (canvas pixels per CSS pixel) a comparison run may cap the canvas at. */
  densityCaps: [1, 1.5, 2, 3] as readonly number[],
  /** `&units=`: texture units per batch the renderer may be set to (Phaser takes 1 on phones by default). */
  textureUnits: [1, 2, 4, 8, 16] as readonly number[],
} as const;

/** Parts of the run screen `&nobg`, `&nofar`, `&nohud` and `&notower` hide while the benchmark draws. */
export const PERF_PARTS = ['bg', 'far', 'hud', 'tower'] as const;
export type PerfPart = (typeof PERF_PARTS)[number];
