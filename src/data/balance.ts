import { LOGICAL_SIZE } from './screen';

/**
 * Every gameplay number from docs/02-gameplay.md. Distances are logical
 * pixels at screen width 1080, speeds are pixels per second.
 * Zone rules live in data/zones.ts.
 */
export const BALANCE = {
  tray: {
    width: 720,
    centerX: LOGICAL_SIZE.width / 2,
  },
  layer: {
    height: 120,
    firstWidth: 720,
    maxWidth: 720,
    gapAboveTower: 180,
    minCenterX: 140,
    maxCenterX: 940,
    fallMs: 110,
    spawnPauseMs: 220,
  },
  speed: {
    base: 600,
    perLayer: 9,
    max: 1400,
  },
  drop: {
    perfectTolerance: 20,
    /** A drop that would leave less than this is a miss. */
    missMargin: 24,
  },
  combo: {
    widenFrom: 2,
    widenBy: 30,
    scoreCap: 10,
  },
  score: {
    normal: 10,
    perfectBase: 25,
    perfectPerCombo: 5,
    goldenPerfectBonus: 100,
  },
  wobble: {
    max: 100,
    /** Gain for a normal drop is `gainFactor * abs(dx) / width`. */
    gainFactor: 60,
    perfectRelief: 15,
    decayPerSec: 2,
    amplitudeMax: 90,
    amplitudeExponent: 1.5,
    periodMs: 2400,
    depthFalloffLayers: 10,
    depthExponent: 2,
    sneezeWidthLoss: 0.15,
    sneezeResetTo: 50,
  },
  team: {
    slots: 3,
    creatureEvery: 6,
    perfectBoost: 1.5,
  },
  coins: {
    fromLayer: 5,
    spawnChance: 0.35,
    maxOffset: 260,
  },
  golden: {
    every: 25,
    perfectBerries: 1,
    normalCoins: 10,
  },
  zones: {
    length: 20,
  },
  continues: {
    max: 2,
    berryCosts: [15, 30],
    offerMs: 5000,
    restoreWidth: 360,
    missSlowMoMs: 400,
  },
  daily: {
    attempts: 3,
    extraAttempts: 1,
    teamLevel: 3,
  },
  tutorial: {
    slowLayers: 3,
    slowSpeedMult: 0.6,
    assistAfterLayers: 8,
    assistTolerance: 30,
    creaturePauseMs: 1500,
    wobbleHintAt: 30,
  },
  sim: {
    stepMs: 1000 / 120,
    /** Longer frames are truncated so a background tab cannot fast-forward a run. */
    maxFrameMs: 250,
  },
} as const;

export interface DifficultyTarget {
  id: 'novice' | 'regular' | 'expert';
  /** Standard deviation of the tap timing error. */
  timingSdMs: number;
  /** Expected median height without creatures. */
  medianHeight: readonly [min: number, max: number];
}

/** Expectations for `npm run sim` (docs/02-gameplay.md, section 12). */
export const DIFFICULTY = {
  runsPerProfile: 2000,
  /** Allowed relative deviation from the expected range before balance must change. */
  tolerance: 0.25,
  targets: [
    { id: 'novice', timingSdMs: 70, medianHeight: [12, 18] },
    { id: 'regular', timingSdMs: 45, medianHeight: [30, 45] },
    { id: 'expert', timingSdMs: 25, medianHeight: [80, 120] },
  ] satisfies DifficultyTarget[],
} as const;
