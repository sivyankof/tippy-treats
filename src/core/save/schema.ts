import type { CreatureId } from '../../data/creatures';

export const SAVE_VERSION = 8;

export type MissionGroup = 'easy' | 'medium' | 'hard';

export interface MissionProgress {
  /** Template id from the mission pool. */
  id: string;
  group: MissionGroup;
  target: number;
  progress: number;
  claimed: boolean;
}

/** One-time hints of the first run; `tutorial` itself means the Honey intro has played. */
export const HINT_IDS = [
  'tutorial',
  'tap',
  'firstPerfect',
  'honey',
  'wobble',
  'berry',
  'firstResults',
  'cloud',
  'oven',
  'dailyIntro',
] as const;
export type HintId = (typeof HINT_IDS)[number];

export type Lang = 'en' | 'ru' | 'auto';

/** `auto` means the player has not chosen: the system setting and the automatic switch decide. */
export type ReducedFxSetting = 'auto' | 'on' | 'off';

export type TeamSlots = [CreatureId | null, CreatureId | null, CreatureId | null];

export interface SaveV1 {
  version: 1;
  /** Random uuid, for the mission seed and support. */
  installId: string;
  /** Epoch ms. */
  createdAt: number;
  lastSeenAt: number;
  coins: number;
  berries: number;
  bakerLevel: number;
  bakerXp: number;
  creatures: Partial<Record<CreatureId, { level: number }>>;
  team: TeamSlots;
  records: { classicHeight: number; classicScore: number; bestCombo: number };
  stats: { runs: number; totalLayers: number; perfects: number; adsWatched: number };
  /** Days are `YYYY-MM-DD` strings, or '' when never set. */
  streak: { count: number; best: number; lastDay: string; cycle: number; claimedToday: boolean };
  missions: { day: string; items: MissionProgress[]; rerollUsed: boolean; chestClaimed: boolean };
  daily: {
    day: string;
    attemptsUsed: number;
    extraAttemptUsed: boolean;
    best: number;
    claimedTiers: number[];
  };
  gift: { nextAt: number };
  shop: { freeCoinsDay: string; freeCoinsUsed: number; starterPackUntil: number };
  purchases: { removeAds: boolean; starterPack: boolean };
  /** Ids of shown hints (`HINT_IDS`); `firstResults` means the first results screen led to Home. */
  tutorial: { firstRunDone: boolean; hintsShown: string[] };
  settings: {
    music: boolean;
    sfx: boolean;
    haptics: boolean;
    reducedFx: ReducedFxSetting;
    lang: Lang;
    notifications: { gift: boolean; streak: boolean; daily: boolean; comeback: boolean };
  };
  ads: { lastInterstitialAt: number; runsSinceInterstitial: number; sessions: number };
  consent: { attAsked: boolean; notifAsked: boolean };
}

/**
 * Version 2 (M6, session 3): the streak keeps the day its calendar reward was claimed instead of
 * a flag that went stale overnight, and `today` keeps the best classic height of the local day
 * (the "so close" line of the results). Missions, the daily tower and the gift keep their V1 shape.
 */
export interface SaveV2 extends Omit<SaveV1, 'version' | 'streak'> {
  version: 2;
  /**
   * `lastDay`: the last local day that counted for the streak (a run finished that day);
   * `claimedDay`: the local day whose calendar reward was claimed; `cycle`: finished 7-day rounds.
   */
  streak: { count: number; best: number; lastDay: string; cycle: number; claimedDay: string };
  /** Best classic height of the local day `day`; it starts over with a new day. */
  today: { day: string; bestHeight: number };
}

/**
 * Version 3 (M6, session 4): `ads.offerDay` keeps the local day the "No ads" offer was last shown,
 * so it comes at most once a day across launches. The rest keeps the V2 shape.
 */
export interface SaveV3 extends Omit<SaveV2, 'version' | 'ads'> {
  version: 3;
  /** `offerDay`: local day (`YYYY-MM-DD`) of the last "No ads" offer, or '' when it was never shown. */
  ads: SaveV2['ads'] & { offerDay: string };
}

/**
 * Version 4 (softer interstitials): `ads.shownDay` and `ads.shownToday` keep how many interstitials
 * the local day has shown, so the daily limit survives a restart. The rest keeps the V3 shape.
 */
export interface SaveV4 extends Omit<SaveV3, 'version' | 'ads'> {
  version: 4;
  /** `shownDay`: local day (`YYYY-MM-DD`) of the last interstitial, '' when none; `shownToday`: shows on that day. */
  ads: SaveV3['ads'] & { shownDay: string; shownToday: number };
}

/**
 * Version 5 (economy): `oven` keeps the "fresh oven" counter of the baker XP (`core/oven.ts`) and
 * `doubles` the "x2 coins" ads watched today (`core/double-coins.ts`). Both count per local day.
 * The baker XP inside the current level is recalculated for the new curve by the migration.
 */
export interface SaveV5 extends Omit<SaveV4, 'version'> {
  version: 5;
  /** `used`: fresh layers spent on `day`; `carry`: layers beyond them that are not a whole XP yet. */
  oven: { day: string; used: number; carry: number };
  /** "x2 coins" ads watched on the local day `day`. */
  doubles: { day: string; used: number };
}

/**
 * Version 6 (clearer daily screen): the shape is the V5 one; the new hint `dailyIntro` marks the
 * explainer of the daily tower as seen. The migration makes sure every player gets it once.
 */
export interface SaveV6 extends Omit<SaveV5, 'version'> {
  version: 6;
}

/**
 * Version 7 (start from a checkpoint): `checkpoints` lists the opened checkpoint heights (a classic
 * run started from zero that reached one opens it for good) and `checkpointAds` counts the ad starts of the local day.
 */
export interface SaveV7 extends Omit<SaveV6, 'version'> {
  version: 7;
  /** Opened checkpoint heights (`CHECKPOINT_HEIGHTS`), ascending; derived from `records.classicHeight` only when missing. */
  checkpoints: number[];
  /** Checkpoint starts paid with a rewarded ad on the local day `day`. */
  checkpointAds: { day: string; used: number };
}

/**
 * Version 8 (Space laps): `bestLap` is the highest Space lap a Classic run ever reached; the
 * first-time lap berries are paid for laps above it. The migration derives it from the record.
 */
export interface SaveV8 extends Omit<SaveV7, 'version'> {
  version: 8;
  /** Highest Space lap reached (`spaceLap` of the tallest Classic tower); 0 below Space. */
  bestLap: number;
}

/** The current save version. */
export type Save = SaveV8;
