import type { CreatureId } from './creatures';

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
  | { kind: 'miss' };

/** Something the director makes happen again and again during a segment. */
export type PerfTrigger =
  | { kind: 'lick'; scene: 'big' | 'short'; drop: 'run' | 'fall'; everyMs: number }
  | { kind: 'guest'; everyMs: number };

/** When the measured window of a segment opens: right after the warm-up, at the miss, or when the results screen is up. */
export type PerfStartOn = 'ready' | 'miss' | 'results';

export interface PerfSegmentDef {
  id: string;
  /** Layers already placed (a checkpoint height takes the checkpoint width). */
  start: number;
  team: ReadonlyArray<CreatureId | null>;
  level: number;
  driver: PerfDriverSpec;
  trigger?: PerfTrigger;
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
    id: 'collapse',
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

/** The knobs of the benchmark that are not per segment. */
export const PERF = {
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
  /** The table overlay. */
  overlay: { zIndex: 99999, fontPx: 11, decimals: 2 },
} as const;
