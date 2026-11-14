import { SAVE_DEFAULTS } from '../../data/save-defaults';
import { SAVE_VERSION, type Save } from './schema';

/** A fresh save: the tutorial creature owned, everything else empty. */
export function createDefaultSave(nowMs: number, installId: string): Save {
  const creatures: Save['creatures'] = {};
  for (const id of SAVE_DEFAULTS.startCreatures) {
    creatures[id] = { level: SAVE_DEFAULTS.startCreatureLevel };
  }
  return {
    version: SAVE_VERSION,
    installId,
    createdAt: nowMs,
    lastSeenAt: nowMs,
    coins: SAVE_DEFAULTS.coins,
    berries: SAVE_DEFAULTS.berries,
    bakerLevel: SAVE_DEFAULTS.bakerLevel,
    bakerXp: SAVE_DEFAULTS.bakerXp,
    creatures,
    team: [SAVE_DEFAULTS.startCreatures[0] ?? null, null, null],
    records: { classicHeight: 0, classicScore: 0, bestCombo: 0 },
    stats: { runs: 0, totalLayers: 0, perfects: 0, adsWatched: 0 },
    streak: { count: 0, best: 0, lastDay: '', cycle: 0, claimedDay: '' },
    today: { day: '', bestHeight: 0 },
    missions: { day: '', items: [], rerollUsed: false, chestClaimed: false },
    daily: { day: '', attemptsUsed: 0, extraAttemptUsed: false, best: 0, claimedTiers: [] },
    gift: { nextAt: 0 },
    shop: { freeCoinsDay: '', freeCoinsUsed: 0, starterPackUntil: 0 },
    purchases: { removeAds: false, starterPack: false },
    tutorial: { firstRunDone: false, hintsShown: [] },
    settings: {
      music: true,
      sfx: true,
      haptics: true,
      reducedFx: 'auto',
      lang: 'auto',
      notifications: { gift: true, streak: true, daily: true, comeback: true },
    },
    ads: { lastInterstitialAt: 0, runsSinceInterstitial: 0, sessions: 0 },
    consent: { attAsked: false, notifAsked: false },
  };
}
