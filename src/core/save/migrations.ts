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

/** Migrations keyed by the version they upgrade from. */
export const MIGRATIONS: MigrationChain = { 1: migrateV1 };

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
