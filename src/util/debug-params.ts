import { isCreatureId, MAX_CREATURE_LEVEL, type CreatureId } from '../data/creatures';
import { BALANCE } from '../data/balance';
import { UINT32_RANGE } from './math';

export interface DebugParams {
  debug: boolean;
  /** Fixed run seed (uint32). */
  seed?: number;
  /** Timing deviation of the bot player in milliseconds. */
  bot?: number;
  /** Number of pre-placed layers at the start of a run. */
  start?: number;
  /** Team of the run, one entry per slot (`null` is an empty slot); at most `BALANCE.team.slots`. */
  team?: Array<CreatureId | null>;
  /** Level of every creature of the team, 1..5. */
  level?: number;
  /** Show the line-up of all 12 creature layers instead of a run (a temporary art-review tool). */
  lineup?: boolean;
  /** `?tutorial=1` forces the tutorial run with every hint fresh, `?tutorial=0` turns all hints off. */
  tutorial?: boolean;
}

const UINT32_MAX = UINT32_RANGE - 1;
const NO_PARAMS: DebugParams = { debug: false };

function parseUint(raw: string | null, max = Number.MAX_SAFE_INTEGER): number | undefined {
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return value <= max ? value : undefined;
}

function parsePositive(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Entries of `?team=a,b,c`: `-` or nothing is an empty slot, unknown ids are dropped. */
function parseTeam(raw: string | null): Array<CreatureId | null> | undefined {
  if (raw === null) return undefined;
  const slots: Array<CreatureId | null> = [];
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (id === '' || id === '-') slots.push(null);
    else if (isCreatureId(id)) slots.push(id);
  }
  return slots.slice(0, BALANCE.team.slots);
}

function parseLevel(raw: string | null): number | undefined {
  const level = parseUint(raw);
  return level !== undefined && level >= 1 && level <= MAX_CREATURE_LEVEL ? level : undefined;
}

/**
 * Reads `?debug`, `?seed=`, `?bot=`, `?start=`, `?team=`, `?level=`, `?lineup=1` and `?tutorial=` from a query string.
 * Invalid values are ignored.
 */
export function parseDebugParams(search: string): DebugParams {
  const params = new URLSearchParams(search);
  const result: DebugParams = { debug: params.has('debug') && params.get('debug') !== '0' };
  const seed = parseUint(params.get('seed'), UINT32_MAX);
  const bot = parsePositive(params.get('bot'));
  const start = parseUint(params.get('start'));
  if (seed !== undefined) result.seed = seed;
  if (bot !== undefined) result.bot = bot;
  if (start !== undefined) result.start = start;
  const team = parseTeam(params.get('team'));
  const level = parseLevel(params.get('level'));
  if (team !== undefined) result.team = team;
  if (level !== undefined) result.level = level;
  if (params.get('lineup') === '1') result.lineup = true;
  const tutorial = params.get('tutorial');
  if (tutorial === '1') result.tutorial = true;
  else if (tutorial === '0') result.tutorial = false;
  return result;
}

/** Debug parameters of the current page. They only apply to dev builds. */
export function readDebugParams(): DebugParams {
  return import.meta.env.DEV ? parseDebugParams(window.location.search) : NO_PARAMS;
}

/**
 * True when the query asks for a hand-picked run (`?team=`, `?level=`, `?bot=` or `?start=`)
 * without `?tutorial=`: such a run is a normal one, with no tutorial and no hints.
 */
export function skipsTutorial(params: DebugParams): boolean {
  if (params.tutorial !== undefined) return false;
  return (
    params.team !== undefined ||
    params.level !== undefined ||
    params.bot !== undefined ||
    params.start !== undefined
  );
}
