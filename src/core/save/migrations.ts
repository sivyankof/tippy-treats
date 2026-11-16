import { recordCreaturesReached } from '../record-unlocks';
import { legacyXpToNext, V5_RECORD_UNLOCKS, v5XpToNext } from './frozen-v5';
import { v7CheckpointsReached } from './frozen-v7';
import { v8LapReached } from './frozen-v8';
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

/** Turns a save of version n into version n + 1 (the `version` field is bumped by `migrate`). */
export type Migration = (raw: RawSave) => RawSave;

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
};

/**
 * Runs the migration chain up to `target`. The result has the right version but is not
 * validated: `loadSave` normalizes it afterwards.
 */
export function migrate(
  raw: unknown,
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
    current = { ...step(current), version: version + 1 };
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
