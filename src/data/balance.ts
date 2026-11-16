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
  /**
   * Speed curve of the flying layer (docs/02-gameplay.md, section 2), px/s by the tower height:
   * linear `base + perLayer * h` up to `arcFrom`, then an easing arc from `arcStart` to `max` that
   * flattens out at `arcTo`, then `max`. `arcStart` equals `base + perLayer * arcFrom` (no jump).
   */
  speed: {
    base: 600,
    perLayer: 9,
    arcFrom: 40,
    arcTo: 160,
    arcStart: 960,
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
    gainFactor: 120,
    perfectRelief: 10,
    decayPerSec: 1,
    amplitudeMax: 130,
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
    /** Perfect landing of a creature layer multiplies the boosted ability value by this; boosted layer counts are rounded with Math.round. */
    perfectBoost: 1.5,
    /** A miss saved by the brownie shield brings the next layer back at least this wide. */
    shieldRestoreWidth: 250,
    /** Level of the debug team (`?level=`) when none is given; the Team screen replaces it in M6. */
    debugLevel: 3,
  },
  coins: {
    fromLayer: 5,
    spawnChance: 0.35,
    maxOffset: 260,
    /** Coins for one collected floating coin before the caramel multiplier. */
    collectAmount: 1,
    /** A perfect drop from this combo on pays `comboAmount` coins (multiplied by caramel). */
    comboFrom: 5,
    comboAmount: 1,
    /** Only every this many perfect drops of a long combo pay: the 2nd, 4th... counted from `comboFrom`. */
    comboEvery: 2,
    /** At run end: `heightBonusCoins` coins for every full `heightBonusEvery` layers. */
    heightBonusEvery: 20,
    heightBonusCoins: 2,
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
  /**
   * Checkpoint starts (docs/02-gameplay.md, section 10; prices approved by the owner 2026-11-14):
   * berries per start height, the heights an ad can pay for, and ad starts per local day.
   */
  checkpoints: {
    berries: { 20: 5, 40: 10, 60: 15, 80: 25, 100: 40 },
    adHeights: [20, 40, 60],
    adsPerDay: 5,
  },
  daily: {
    attempts: 3,
    extraAttempts: 1,
    teamLevel: 3,
  },
  /** Interstitial ads (docs/05-economy-monetization.md, section 6); the rules are in core/video-policy.ts. */
  ads: {
    interstitial: {
      /** Sessions 1..firstSessionsFree have no interstitials at all. */
      firstSessionsFree: 3,
      /** ...and neither has the time after the first launch; whichever of the two ends later counts. */
      firstFreeMs: 24 * 60 * 60 * 1000,
      /** Finished runs since the last interstitial. */
      minRuns: 4,
      /** Time since the last interstitial. */
      minGapMs: 180_000,
      /** Shows per launch of the app. */
      maxPerSession: 4,
      /** Shows per local day. */
      maxPerDay: 12,
      /** The run that just ended lasted at least this long. */
      minRunMs: 15_000,
    },
    /** The "no ads" offer comes once per session after this many interstitials shown in it. */
    removeAdsOfferAfter: 2,
  },
  /**
   * Streak reward (docs/02-gameplay.md, section 2): after `afterPerfects` perfect drops in a row
   * the next `layers` layers fly `speedMult` times as fast; a new one starts at least
   * `minGapLayers` layers after the previous one started. Not in the tutorial run.
   */
  tempoEase: { afterPerfects: 5, layers: 3, speedMult: 0.85, minGapLayers: 10 },
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
  id: 'novice' | 'regular' | 'expert' | 'strong';
  /** Standard deviation of the tap timing error. */
  timingSdMs: number;
  /**
   * Calibration profile for analysis: `npm run sim` plays it only with `--profile=<id>`, so the
   * balance checks over the design profiles (and their acceptance criteria) stay as they were.
   */
  analysisOnly?: true;
  /** Expected median height without creatures. */
  medianHeight: readonly [min: number, max: number];
}

/** Expectations for `npm run sim` (docs/02-gameplay.md, section 12). */
export const DIFFICULTY = {
  runsPerProfile: 2000,
  /**
   * Bot-model assumption, not a game rule: the ghost guides make the bot's timing error this
   * much smaller (the real effect on a human player is not measurable by a bot).
   */
  guidesSdMult: 0.7,
  /**
   * Bot-model assumption, not a game rule, NOT VERIFIED on players: while a cloud covers the
   * flying layer the bot's timing error is this many times larger. The cloud is drawn at
   * density 0.85, so the layer shows as a pale silhouette (1.5 while it was opaque, until
   * 2026-11-17).
   */
  cloudSdMult: 1.4,
  /**
   * Bot-model assumption, not a game rule, NOT VERIFIED on players (check with testers, M9):
   * while the guides of a level-5 ghost are on ("Not scary"), the cloud is see-through and the
   * bot's error under it is multiplied by this instead of `cloudSdMult` (tuned).
   */
  ghostCloudSdMult: 1.2,
  /**
   * Bot-model assumption, not a game rule, NOT VERIFIED on players (check with testers, M9):
   * in Space the cloud is a see-through nebula (the layer's silhouette shows about a third; 1.4 by
   * the owner's decision 2026-11-17, was 1.25), so
   * the bot's error under it is multiplied by this instead of `cloudSdMult`; under the "Not
   * scary" guides the smaller of this and `ghostCloudSdMult` applies.
   */
  nebulaSdMult: 1.4,
  /** Allowed relative deviation from the expected range before balance must change. */
  tolerance: 0.25,
  targets: [
    { id: 'novice', timingSdMs: 70, medianHeight: [12, 18] },
    { id: 'regular', timingSdMs: 45, medianHeight: [30, 45] },
    { id: 'expert', timingSdMs: 25, medianHeight: [80, 120] },
    // Live-player calibration (a tester's runs, no ads, no debug), not a design target:
    // sd 20 ms puts the median near 100 layers and a 100-layer run near 80 coins (docs/02, section 12).
    { id: 'strong', timingSdMs: 20, medianHeight: [110, 130], analysisOnly: true },
  ] satisfies DifficultyTarget[],
} as const;
