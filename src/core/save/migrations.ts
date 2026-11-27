import { recordCreaturesReached } from '../progression/record-unlocks';
import { legacyXpToNext, V5_RECORD_UNLOCKS, v5XpToNext } from './frozen-v5';
import { v7CheckpointsReached } from './frozen-v7';
import { v8LapReached } from './frozen-v8';
import { V9_STARTER_PACK_MIN_RUNS } from './frozen-v9';
import { SAVE_VERSION, type Save } from './schema';

export type SaveErrorCode = 'not_object' | 'bad_version' | 'future_version' | 'missing_migration';

/** The save cannot be used as is; the loader falls back to the backup or a new save. */
export class SaveError extends Error {
  readonly code: SaveErrorCode;

  constructor(code: SaveErrorCode, message: string) {
    super(message);
    this.name = 'SaveError';
    this.code = code;
  }
}

export type RawSave = Record<string, unknown>;

/**
 * Turns a save of version n into version n + 1 (the `version` field is bumped by `migrate`).
 * `nowMs` is the time of the load, for a step that has to start something now.
 */
export type Migration = (raw: RawSave, nowMs: number) => RawSave;

export type MigrationChain = Readonly<Record<number, Migration>>;

function isRecord(value: unknown): value is RawSave {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 1 → 2: `streak.claimedToday` (a flag without a day) becomes `streak.claimedDay`: a claim is
 * kept for the day the streak last counted, the only day it can belong to; `today` starts empty.
 */
export function migrateV1(raw: RawSave): RawSave {
  const streak = isRecord(raw.streak) ? raw.streak : {};
  const { claimedToday, ...rest } = streak;
  const lastDay = typeof rest.lastDay === 'string' ? rest.lastDay : '';
  return {
    ...raw,
    streak: { ...rest, claimedDay: claimedToday === true ? lastDay : '' },
    today: { day: '', bestHeight: 0 },
  };
}

/** 2 → 3: `ads.offerDay` starts empty, so the "No ads" offer may come on the first Home entry. */
export function migrateV2(raw: RawSave): RawSave {
  const ads = isRecord(raw.ads) ? raw.ads : {};
  return { ...raw, ads: { ...ads, offerDay: '' } };
}

/** 3 → 4: the daily interstitial count starts empty (no day, no shows). */
export function migrateV3(raw: RawSave): RawSave {
  const ads = isRecord(raw.ads) ? raw.ads : {};
  return { ...raw, ads: { ...ads, shownDay: '', shownToday: 0 } };
}

/**
 * 4 → 5: the oven and the "x2 coins" counters start empty (a full oven on the first day), and the
 * XP inside the current level is rescaled to the new curve in proportion, so the bar keeps its fill:
 * `floor(xp / oldXpToNext * newXpToNext)`. The baker level and the creature levels are never lowered.
 */
export function migrateV4(raw: RawSave): RawSave {
  const next: RawSave = {
    ...raw,
    oven: { day: '', used: 0, carry: 0 },
    doubles: { day: '', used: 0 },
  };
  // A damaged or missing XP stays as it is, so the loader can still tell the save is damaged.
  if (typeof raw.bakerXp === 'number' && Number.isFinite(raw.bakerXp)) {
    const level = typeof raw.bakerLevel === 'number' ? Math.max(1, Math.floor(raw.bakerLevel)) : 1;
    const oldNeed = legacyXpToNext(level);
    const oldXp = raw.bakerXp > 0 ? Math.floor(raw.bakerXp) : 0;
    const newNeed = v5XpToNext(level);
    next.bakerXp = Math.min(newNeed - 1, Math.floor((oldXp / oldNeed) * newNeed));
  }
  return withRecordCreatures(next);
}

/**
 * 5 -> 6: the explainer of the daily tower is new for everyone, players who already played the
 * daily tower included, so `dailyIntro` starts as not shown. A damaged hint list stays as it is.
 */
export function migrateV5(raw: RawSave): RawSave {
  const tutorial = isRecord(raw.tutorial) ? raw.tutorial : null;
  if (!tutorial || !Array.isArray(tutorial.hintsShown)) return raw;
  const hintsShown = tutorial.hintsShown.filter((id) => id !== 'dailyIntro');
  return { ...raw, tutorial: { ...tutorial, hintsShown } };
}

/**
 * 6 -> 7: the checkpoints the best classic height already reached are open, and no ad start was
 * used. A damaged record counts as 0.
 */
export function migrateV6(raw: RawSave): RawSave {
  const height = rawClassicHeight(raw);
  return {
    ...raw,
    checkpoints: v7CheckpointsReached(height),
    checkpointAds: { day: '', used: 0 },
  };
}

/**
 * 7 -> 8: the laps the best classic height already reached count as reached, so nothing is paid
 * retroactively. A damaged record counts as 0.
 */
export function migrateV7(raw: RawSave): RawSave {
  const height = rawClassicHeight(raw);
  return { ...raw, bestLap: v8LapReached(height) };
}

/**
 * 8 -> 9: the 7-day window of the starter pack now starts at its first show on Home. A player
 * who has not bought it and already finished the runs that let Home show it gets a full window
 * from now; anyone else starts with no show yet (it is set at the first show). A damaged
 * purchase flag or run count counts as not bought and no runs.
 */
export function migrateV8(raw: RawSave, nowMs: number): RawSave {
  const shop = isRecord(raw.shop) ? raw.shop : {};
  const purchases = isRecord(raw.purchases) ? raw.purchases : {};
  const stats = isRecord(raw.stats) ? raw.stats : {};
  const runs = typeof stats.runs === 'number' && Number.isFinite(stats.runs) ? stats.runs : 0;
  const due = purchases.starterPack !== true && runs >= V9_STARTER_PACK_MIN_RUNS;
  return { ...raw, shop: { ...shop, starterPackShownAt: due ? nowMs : 0 } };
}

/**
 * 9 -> 10: no store transaction is known yet (owned one-time purchases come back through the
 * launch check with the store), the rating was never asked and no play day is counted yet.
 */
export function migrateV9(raw: RawSave): RawSave {
  return {
    ...raw,
    iap: { processedTx: [] },
    review: { askedVersion: '', askedAt: 0, playDays: 0, lastPlayDay: '' },
    notif: { giftDay: '' },
  };
}

/**
 * 10 -> 11: no fly was counted before, the best daily height of all time starts from today's
 * best, no earlier play day is known, and the device never synced (its progress counts as
 * changed). A damaged stats or records object stays as it is, so the loader can still tell.
 */
export function migrateV10(raw: RawSave): RawSave {
  const next: RawSave = {
    ...raw,
    prevDay: { day: '', bestHeight: 0 },
    sync: { cloudRev: 0, cloudId: '', dirty: true },
  };
  if (isRecord(raw.stats)) next.stats = { ...raw.stats, flies: 0 };
  if (isRecord(raw.records)) {
    const daily = isRecord(raw.daily) ? raw.daily : {};
    const best = typeof daily.best === 'number' && Number.isFinite(daily.best) ? daily.best : 0;
    next.records = { ...raw.records, dailyBest: best };
  }
  return next;
}

/** Hands over creatures whose record way (as of version 5) the best classic height already reached. */
function withRecordCreatures(raw: RawSave): RawSave {
  const height = rawClassicHeight(raw);
  if (!isRecord(raw.creatures)) return raw;
  const owned = raw.creatures;
  const creatures: RawSave = { ...owned };
  for (const id of recordCreaturesReached(
    height,
    (creature) => owned[creature] !== undefined,
    V5_RECORD_UNLOCKS,
  )) {
    creatures[id] = { level: 1 };
  }
  return { ...raw, creatures };
}

/** Migrations keyed by the version they upgrade from. */
export const MIGRATIONS: MigrationChain = {
  1: migrateV1,
  2: migrateV2,
  3: migrateV3,
  4: migrateV4,
  5: migrateV5,
  6: migrateV6,
  7: migrateV7,
  8: migrateV8,
  9: migrateV9,
  10: migrateV10,
};

/**
 * Runs the migration chain up to `target`. The result has the right version but is not
 * validated: `loadSave` normalizes it afterwards.
 */
export function migrate(
  raw: unknown,
  /** Time of the load, epoch ms (`Migration`). */
  nowMs: number,
  chain: MigrationChain = MIGRATIONS,
  target: number = SAVE_VERSION,
): Save {
  if (!isRecord(raw)) throw new SaveError('not_object', 'save is not an object');
  let version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new SaveError('bad_version', 'save has no valid version');
  }
  if (version > target) throw new SaveError('future_version', `save version ${version} is newer`);
  let current: RawSave = raw;
  while (version < target) {
    const step = chain[version];
    if (!step) throw new SaveError('missing_migration', `no migration from version ${version}`);
    current = { ...step(current, nowMs), version: version + 1 };
    version += 1;
  }
  return current as unknown as Save;
}

/** Best classic height of a raw save; a missing or damaged record counts as 0. */
function rawClassicHeight(raw: RawSave): number {
  const records = isRecord(raw.records) ? raw.records : {};
  const height = records.classicHeight;
  return typeof height === 'number' && Number.isFinite(height) ? height : 0;
}
