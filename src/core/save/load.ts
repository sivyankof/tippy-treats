import { CREATURE_IDS, MAX_CREATURE_LEVEL, type CreatureId } from '../../data/creatures';
import { MAX_BAKER_LEVEL } from '../../data/progression';
import { SAVE_DEFAULTS } from '../../data/save-defaults';
import { xpToNext } from '../progression';
import { createDefaultSave } from './defaults';
import { migrate } from './migrations';
import type {
  Lang,
  MissionGroup,
  MissionProgress,
  ReducedFxSetting,
  Save,
  TeamSlots,
} from './schema';

export type SaveSource = 'primary' | 'backup' | 'new';

/** A stored text that was not used, and which key it came from. */
export interface CorruptText {
  key: 'save' | 'backup';
  text: string;
}

export interface LoadResult {
  save: Save;
  source: SaveSource;
  /** Texts that could not be used, for the state layer to keep under `save_corrupt_<time>[_backup]`. */
  corrupt: CorruptText[];
}

type Obj = Record<string, unknown>;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LANGS: readonly Lang[] = ['en', 'ru', 'auto'];
const FX_SETTINGS: readonly ReducedFxSetting[] = ['auto', 'on', 'off'];
const MISSION_GROUPS: readonly MissionGroup[] = ['easy', 'medium', 'hard'];

const obj = (value: unknown): Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Obj) : {};

/** Non-negative integer, or the fallback for anything else. */
function uint(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, Math.floor(value)));
}

const bool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;

const day = (value: unknown): string =>
  typeof value === 'string' && DAY_RE.test(value) ? value : '';

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string'))]
    : [];

/** The creatures of the save; the starter creatures are always owned, whatever the text says. */
function normalizeCreatures(value: unknown): Save['creatures'] {
  const source = obj(value);
  const result: Save['creatures'] = {};
  for (const id of CREATURE_IDS) {
    if (!(id in source)) continue;
    const level = uint(obj(source[id]).level, 1);
    result[id] = { level: Math.min(MAX_CREATURE_LEVEL, Math.max(1, level)) };
  }
  for (const id of SAVE_DEFAULTS.startCreatures) {
    result[id] ??= { level: SAVE_DEFAULTS.startCreatureLevel };
  }
  return result;
}

/** Three slots of owned creatures; a team with nobody in it gets the first starter creature in slot 0. */
function normalizeTeam(value: unknown, owned: Save['creatures'], fallback: TeamSlots): TeamSlots {
  const slots = pickTeam(value, owned, fallback);
  const first = SAVE_DEFAULTS.startCreatures[0];
  if (slots.every((slot) => slot === null) && first !== undefined) slots[0] = first;
  return slots;
}

function pickTeam(value: unknown, owned: Save['creatures'], fallback: TeamSlots): TeamSlots {
  if (!Array.isArray(value)) return [...fallback];
  const used = new Set<CreatureId>();
  const picked = [0, 1, 2].map((index): CreatureId | null => {
    const entry: unknown = value[index];
    const id = CREATURE_IDS.find((creatureId) => creatureId === entry);
    if (id === undefined || owned[id] === undefined || used.has(id)) return null;
    used.add(id);
    return id;
  });
  return picked as TeamSlots;
}

function normalizeMissions(value: unknown): MissionProgress[] {
  if (!Array.isArray(value)) return [];
  const items: MissionProgress[] = [];
  for (const entry of value) {
    const item = obj(entry);
    if (typeof item.id !== 'string' || item.id === '') continue;
    items.push({
      id: item.id,
      group: oneOf(item.group, MISSION_GROUPS, 'easy'),
      target: uint(item.target, 0),
      progress: uint(item.progress, 0),
      claimed: bool(item.claimed, false),
    });
  }
  return items;
}

function normalizeTiers(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const tiers = value
    .filter((tier): tier is number => typeof tier === 'number' && tier >= 0)
    .map((tier) => uint(tier, 0));
  return [...new Set(tiers)];
}

/** Fills every missing or wrongly typed field from `d` and clamps numbers. */
function normalize(raw: Obj, d: Save): Save {
  const records = obj(raw.records);
  const stats = obj(raw.stats);
  const streak = obj(raw.streak);
  const missions = obj(raw.missions);
  const daily = obj(raw.daily);
  const shop = obj(raw.shop);
  const purchases = obj(raw.purchases);
  const tutorial = obj(raw.tutorial);
  const settings = obj(raw.settings);
  const notifications = obj(settings.notifications);
  const ads = obj(raw.ads);
  const consent = obj(raw.consent);
  const creatures = normalizeCreatures(raw.creatures);
  const bakerLevel = Math.min(MAX_BAKER_LEVEL, Math.max(1, uint(raw.bakerLevel, d.bakerLevel)));
  return {
    version: d.version,
    installId:
      typeof raw.installId === 'string' && raw.installId !== '' ? raw.installId : d.installId,
    createdAt: uint(raw.createdAt, d.createdAt),
    lastSeenAt: uint(raw.lastSeenAt, d.lastSeenAt),
    coins: uint(raw.coins, d.coins),
    berries: uint(raw.berries, d.berries),
    bakerLevel,
    // Below the level-up threshold: a huge value would otherwise freeze the next run in level-ups.
    bakerXp: Math.min(uint(raw.bakerXp, d.bakerXp), xpToNext(bakerLevel) - 1),
    creatures,
    team: normalizeTeam(raw.team, creatures, d.team),
    records: {
      classicHeight: uint(records.classicHeight, 0),
      classicScore: uint(records.classicScore, 0),
      bestCombo: uint(records.bestCombo, 0),
    },
    stats: {
      runs: uint(stats.runs, 0),
      totalLayers: uint(stats.totalLayers, 0),
      perfects: uint(stats.perfects, 0),
      adsWatched: uint(stats.adsWatched, 0),
    },
    streak: {
      count: uint(streak.count, 0),
      best: uint(streak.best, 0),
      lastDay: day(streak.lastDay),
      cycle: uint(streak.cycle, 0),
      claimedToday: bool(streak.claimedToday, false),
    },
    missions: {
      day: day(missions.day),
      items: normalizeMissions(missions.items),
      rerollUsed: bool(missions.rerollUsed, false),
      chestClaimed: bool(missions.chestClaimed, false),
    },
    daily: {
      day: day(daily.day),
      attemptsUsed: uint(daily.attemptsUsed, 0),
      extraAttemptUsed: bool(daily.extraAttemptUsed, false),
      best: uint(daily.best, 0),
      claimedTiers: normalizeTiers(daily.claimedTiers),
    },
    gift: { nextAt: uint(obj(raw.gift).nextAt, 0) },
    shop: {
      freeCoinsDay: day(shop.freeCoinsDay),
      freeCoinsUsed: uint(shop.freeCoinsUsed, 0),
      starterPackUntil: uint(shop.starterPackUntil, 0),
    },
    purchases: {
      removeAds: bool(purchases.removeAds, false),
      starterPack: bool(purchases.starterPack, false),
    },
    tutorial: {
      firstRunDone: bool(tutorial.firstRunDone, false),
      hintsShown: strings(tutorial.hintsShown),
    },
    settings: {
      music: bool(settings.music, d.settings.music),
      sfx: bool(settings.sfx, d.settings.sfx),
      haptics: bool(settings.haptics, d.settings.haptics),
      reducedFx: oneOf(settings.reducedFx, FX_SETTINGS, d.settings.reducedFx),
      lang: oneOf(settings.lang, LANGS, d.settings.lang),
      notifications: {
        gift: bool(notifications.gift, d.settings.notifications.gift),
        streak: bool(notifications.streak, d.settings.notifications.streak),
        daily: bool(notifications.daily, d.settings.notifications.daily),
        comeback: bool(notifications.comeback, d.settings.notifications.comeback),
      },
    },
    ads: {
      lastInterstitialAt: uint(ads.lastInterstitialAt, 0),
      runsSinceInterstitial: uint(ads.runsSinceInterstitial, 0),
      sessions: uint(ads.sessions, 0),
    },
    consent: {
      attAsked: bool(consent.attAsked, false),
      notifAsked: bool(consent.notifAsked, false),
    },
  };
}

interface Parsed {
  save: Save;
  /** The key fields are all present with the right types; false means field-by-field recovery was needed. */
  intact: boolean;
}

/** Fields whose loss would silently reset the progress of the player. */
function hasKeyFields(raw: Obj): boolean {
  const isNum = (value: unknown): boolean => typeof value === 'number' && Number.isFinite(value);
  const isObj = (value: unknown): boolean =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  return (
    isNum(raw.coins) &&
    isNum(raw.berries) &&
    isNum(raw.bakerLevel) &&
    isNum(raw.bakerXp) &&
    isObj(raw.creatures) &&
    isObj(raw.records) &&
    isObj(raw.stats)
  );
}

/** Parses, migrates and normalizes one stored text; null when it cannot be used. */
function parseSave(text: string, defaults: Save): Parsed | null {
  try {
    const migrated = migrate(JSON.parse(text) as unknown) as unknown as Obj;
    return { save: normalize(migrated, defaults), intact: hasKeyFields(migrated) };
  } catch {
    return null;
  }
}

const isStored = (text: string | null): text is string => text !== null && text !== '';

/**
 * Picks the primary save, then the backup, then a new save. Never throws. A primary of the
 * current version with missing or wrong key fields counts as corrupt when an intact backup
 * exists; without one it is repaired field by field.
 */
export function loadSave(
  primary: string | null,
  backup: string | null,
  nowMs: number,
  makeInstallId: () => string,
): LoadResult {
  const defaults = createDefaultSave(nowMs, makeInstallId());
  const fromPrimary = isStored(primary) ? parseSave(primary, defaults) : null;
  if (fromPrimary?.intact) return { save: fromPrimary.save, source: 'primary', corrupt: [] };
  const fromBackup = isStored(backup) ? parseSave(backup, defaults) : null;
  if (fromPrimary && !fromBackup?.intact) {
    return { save: fromPrimary.save, source: 'primary', corrupt: [] };
  }
  const corrupt: CorruptText[] = [];
  if (isStored(primary)) corrupt.push({ key: 'save', text: primary });
  if (fromBackup) return { save: fromBackup.save, source: 'backup', corrupt };
  if (isStored(backup)) corrupt.push({ key: 'backup', text: backup });
  return { save: defaults, source: 'new', corrupt };
}

export function serializeSave(save: Save): string {
  return JSON.stringify(save);
}
