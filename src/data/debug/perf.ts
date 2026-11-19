import type { CreatureId } from '../creatures/creatures';
import type { CutVariantName } from '../cuts/cut-look';
import { MASTERY } from '../creatures/mastery';
import type { WeatherId } from '../weather/weather';

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
  /** The weather of the segment, whatever `&weather=` says (the heavy segment plays in snow). */
  weather?: WeatherId;
  /** The starting tower carries a juice stain on every layer, as with `&marks=1`. */
  marks?: boolean;
  /** The starting tower is stepped (`PERF_STEPS`): ledges on both sides, so the snow drifts have places to lie. */
  steps?: boolean;
  /** Unmeasured time from the moment the run is ready (the camera has risen). */
  warmupMs: number;
  /** Length of the measured window. */
  measureMs: number;
  startOn: PerfStartOn;
  /** The window also closes when the results screen opens (the collapse). */
  endOnResults?: boolean;
  /** The window closes `PERF.transition.tailMs` after the cross-fade of the zone change has ended (the transition segments). */
  endAfterFade?: boolean;
  /** Worst frame work time this segment is held to instead of `PERF_BUDGET.workWorstMs`, ms. */
  workWorstMs?: number;
}

const NO_TEAM: ReadonlyArray<CreatureId | null> = [null, null, null];

/** The zone boundaries the transition segments cross: the height whose next layer is the first of a new zone. */
export const PERF_TRANSITION = {
  /** A segment starts this many layers below its boundary, so everything the change prepares happens in the window. */
  layersBefore: 10,
  /** The window stays open this long after the cross-fade has ended. */
  tailMs: 800,
  /** Longest window: a run that never reaches the boundary ends here with a note. */
  measureMs: 40000,
  /** Worst frame work time of a transition segment, ms (headless; the zone change must not hitch). */
  workWorstMs: 12,
} as const;

/** One transition segment: a bot that drops (almost) every layer perfectly through the boundary. */
function transitionSegment<B extends number>(boundary: B) {
  return {
    id: `transition-${boundary}` as const,
    drawClass: 'heavy',
    start: boundary - PERF_TRANSITION.layersBefore,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'bot', sdMs: 3 },
    warmupMs: 500,
    measureMs: PERF_TRANSITION.measureMs,
    startOn: 'ready',
    endAfterFade: true,
    workWorstMs: PERF_TRANSITION.workWorstMs,
  } as const satisfies PerfSegmentDef;
}

/** The steps of the starting tower of a `steps` segment: layer `i` is `1 - narrowing * (i % period)` of its width and stands off-centre by `shiftShare` of it, alternately to each side. */
export const PERF_STEPS = {
  period: 4,
  narrowing: 0.09,
  shiftShare: 0.045,
  /** The top layers keep their own width and place (the next layer lands on the top one). */
  untouchedTop: 3,
} as const;

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
  {
    // Session 5g: the heaviest scene of the game: snow on the Roof, a stepped tower with drifts on its ledges and a mark on
    // every layer, a cut on every landing (strands), the crew through `&mastery=master`.
    id: 'heavy',
    drawClass: 'heavy',
    start: 50,
    team: NO_TEAM,
    level: 1,
    driver: { kind: 'cut', share: 0.12 },
    cutVariant: 'strands',
    weather: 'snow',
    marks: true,
    steps: true,
    warmupMs: 2000,
    measureMs: 14000,
    startOn: 'ready',
  },
  transitionSegment(20),
  transitionSegment(40),
  transitionSegment(60),
  transitionSegment(80),
  transitionSegment(100),
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
  /** Worst frame work time, ms (a segment may hold itself to less: `PerfSegmentDef.workWorstMs`). */
  workWorstMs: 50,
  /** Most draw calls of one frame while two zones cross-fade (the transition segments). */
  fadeDrawsMax: 60,
  /** Mean time between frames, ms (about 55 fps). */
  intervalMeanMs: 18,
  /** Share of the shared atlas page height that stays free at the peak of the shelves; with less (or with a second page) the benchmark is over the budget. */
  atlasMinSpare: 0.2,
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
