import type { CreatureId } from '../../data/creatures';

export const SAVE_VERSION = 2;

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

/** The current save version. */
export type Save = SaveV2;
