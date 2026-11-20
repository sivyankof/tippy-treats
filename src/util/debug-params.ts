import { isCreatureId, MAX_CREATURE_LEVEL, type CreatureId } from '../data/creatures/creatures';
import { BALANCE } from '../data/tower/balance';
import { isSpaceVisitorId, type SpaceVisitorId } from '../data/guests/space-visitor';
import { isEffectLevel, type EffectLevel } from '../data/app/effect-levels';
import {
  isPerfSegmentId,
  PERF,
  PERF_PARTS,
  type PerfPart,
  type PerfSegmentId,
} from '../data/debug/perf';
import { isStartPlaceId, type StartPlaceId } from '../data/zones/start-places';
import { isWeatherId, type WeatherId } from '../data/weather/weather';
import { isResultsDemoCase, type ResultsDemoCase } from '../data/debug/results-demo';
import { UINT32_RANGE } from './math';
import { DEBUG_TOOLS } from './build-kind';

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
  /** Show the art sheet: every picture of the texture registry in one grid (a dev tool). */
  artsheet?: boolean;
  /** Open the results screen on a synthetic run with every block filled (a dev tool for the short-screen fit). */
  resultsDemo?: ResultsDemoCase;
  /** `?tutorial=1` forces the tutorial run with every hint fresh, `?tutorial=0` turns all hints off. */
  tutorial?: boolean;
  /** Shifts the game clock by whole days (may be negative) to test the streak, missions and daily tower. */
  dayOffset?: number;
  /** `?spaceGuest=eclair|saucer|teapot|comet` makes that rare guest of Space cross the screen soon (a dev tool for screenshots). */
  spaceGuest?: SpaceVisitorId;
  /** `?reset=1` makes the state layer start from a fresh save. */
  reset?: boolean;
  /** `?consent=1` makes the browser play the phone's consent: the tracking question is open and the privacy options are offered (a dev tool for screenshots). */
  consent?: boolean;
  /** `?weather=clear|sunset|night|rain|snow|leaves|storm` pins the weather of the run (the run is not saved). */
  weather?: WeatherId;
  /** `?place=kitchen|shop` pins the start place of zone 1 (the run is not saved). */
  place?: StartPlaceId;
  /** `?safe=59,34` stands in for the top and bottom safe-area insets (CSS px), to see the layout of a phone with an island in a browser. */
  safe?: { top: number; bottom: number };
}

const UINT32_MAX = UINT32_RANGE - 1;
const NO_PARAMS: DebugParams = { debug: false };

function parseUint(raw: string | null, max = Number.MAX_SAFE_INTEGER): number | undefined {
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return value <= max ? value : undefined;
}

const MAX_DAY_OFFSET = 3650;

function parseDayOffset(raw: string | null): number | undefined {
  if (raw === null || !/^-?\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  return Math.abs(value) <= MAX_DAY_OFFSET ? value : undefined;
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

const MAX_SAFE_INSET = 200;

/** `?safe=top,bottom`: two whole CSS px values from 0 to 200. */
function parseSafe(raw: string | null): { top: number; bottom: number } | undefined {
  const match = raw === null ? null : /^(\d{1,3}),(\d{1,3})$/.exec(raw.trim());
  if (!match) return undefined;
  const top = Number(match[1]);
  const bottom = Number(match[2]);
  return top <= MAX_SAFE_INSET && bottom <= MAX_SAFE_INSET ? { top, bottom } : undefined;
}

function parseLevel(raw: string | null): number | undefined {
  const level = parseUint(raw);
  return level !== undefined && level >= 1 && level <= MAX_CREATURE_LEVEL ? level : undefined;
}

/**
 * Reads `?debug`, `?seed=`, `?bot=`, `?start=`, `?team=`, `?level=`, `?lineup=1`, `?artsheet=1`, `?tutorial=`, `?dayOffset=` and `?reset=1` from a query string.
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
  if (params.get('artsheet') === '1') result.artsheet = true;
  const resultsDemo = params.get('resultsDemo');
  if (isResultsDemoCase(resultsDemo)) result.resultsDemo = resultsDemo;
  const tutorial = params.get('tutorial');
  if (tutorial === '1') result.tutorial = true;
  else if (tutorial === '0') result.tutorial = false;
  const dayOffset = parseDayOffset(params.get('dayOffset'));
  if (dayOffset !== undefined) result.dayOffset = dayOffset;
  if (params.get('reset') === '1') result.reset = true;
  if (params.get('consent') === '1') result.consent = true;
  const spaceGuest = params.get('spaceGuest');
  if (isSpaceVisitorId(spaceGuest)) result.spaceGuest = spaceGuest;
  const weather = params.get('weather');
  if (isWeatherId(weather)) result.weather = weather;
  const place = params.get('place');
  if (isStartPlaceId(place)) result.place = place;
  const safe = parseSafe(params.get('safe'));
  if (safe) result.safe = safe;
  return result;
}

/** `?fps=1` shows the small frame counter. It works in dev and production builds alike, unlike the other debug parameters. */
export function showsFpsMeter(search: string): boolean {
  return new URLSearchParams(search).get('fps') === '1';
}

/** What `?perf=1` asked for. */
export interface PerfParams {
  /** `fx=full|lite|minimal` pins that effects level for the whole run (`reduced` is `minimal`); the default pins full effects. */
  fx: EffectLevel;
  /** `only=a,b`: just these segments, in the order of the benchmark; `null` for all of them. */
  only: PerfSegmentId[] | null;
  /** `still=tower|tongue|arc` (or a segment id): play that segment and freeze at a fixed moment, no measuring. */
  still: PerfSegmentId | null;
  /** `dpr=1|1.5|2|3`: canvas pixels per CSS pixel at most; absent leaves the cap to the effects level (`followEffectsLevelDensity`). */
  densityCap?: number;
  /** `units=1|2|4|8|16`: texture units per batch; absent keeps what Phaser picked. */
  textureUnits?: number;
  /** `nobg`, `nofar`, `nohud`, `notower`: parts of the run screen not drawn; absent when nothing is hidden. */
  hidden?: PerfPart[];
  /** `mastery=on|off`: every segment without a team plays the mastery team at the grown level (`on`) or one level below it (`off`, the control); `master` plays it at the master level (the captions and master effects of a run); absent keeps the segments as they are. */
  mastery?: 'on' | 'off' | 'master';
  /** `marks=1`: every layer of the starting tower carries a juice stain (the trace benchmark); absent leaves the layers clean. */
  marks?: boolean;
  /** `weather=<id>`: the weather of every benchmark run; absent is clear. */
  weather?: WeatherId;
  /** `place=<id>`: the start place of every benchmark run; absent is the kitchen. */
  place?: StartPlaceId;
}

/** A number of the query that is one of `allowed`; `undefined` otherwise. */
function pickNumber(raw: string | null, allowed: readonly number[]): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const value = Number(raw);
  return allowed.includes(value) ? value : undefined;
}

/**
 * Reads `?perf=1&fx=lite&only=calm,edge&still=tongue&dpr=2&units=16&nobg&nohud`; `null` when `?perf=1`
 * is absent. It works in dev and production builds alike, like `?fps=1`. Unknown segment names and
 * values outside the allowed lists are dropped.
 */
export function parsePerfParams(search: string): PerfParams | null {
  const params = new URLSearchParams(search);
  if (params.get('perf') !== '1') return null;
  const names = (params.get('only') ?? '').split(',').map((name) => name.trim());
  const only = names.filter(isPerfSegmentId);
  const still = params.get('still')?.trim() ?? '';
  const named = Object.entries(PERF.stills).find(([name]) => name === still)?.[1];
  const stillId = named ?? (isPerfSegmentId(still) ? still : null);
  const result: PerfParams = {
    fx: perfFx(params.get('fx')),
    only: only.length > 0 ? only : null,
    still: stillId,
  };
  const densityCap = pickNumber(params.get('dpr'), PERF.densityCaps);
  const textureUnits = pickNumber(params.get('units'), PERF.textureUnits);
  const hidden = PERF_PARTS.filter(
    (part) => params.has(`no${part}`) && params.get(`no${part}`) !== '0',
  );
  if (densityCap !== undefined) result.densityCap = densityCap;
  if (textureUnits !== undefined) result.textureUnits = textureUnits;
  if (hidden.length > 0) result.hidden = hidden;
  const mastery = params.get('mastery');
  if (mastery === 'on' || mastery === 'off' || mastery === 'master') result.mastery = mastery;
  if (params.get('marks') === '1') result.marks = true;
  const weather = params.get('weather');
  if (isWeatherId(weather)) result.weather = weather;
  const place = params.get('place');
  if (isStartPlaceId(place)) result.place = place;
  return result;
}

/** The pinned level of `fx=`: a level name, `reduced` as another name of `minimal`, else full. */
function perfFx(value: string | null): EffectLevel {
  if (value === 'reduced') return 'minimal';
  return isEffectLevel(value) ? value : 'full';
}

/** The benchmark parameters of the current page; `null` for a normal start. */
export function readPerfParams(): PerfParams | null {
  return parsePerfParams(window.location.search);
}

/** Debug parameters of the current page. They only apply to the dev server and the internal build. */
export function readDebugParams(): DebugParams {
  return DEBUG_TOOLS ? parseDebugParams(window.location.search) : NO_PARAMS;
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

/**
 * Whether a run goes into the save. `?bot=`, `?start=`, `?team=`, `?level=`, `?weather=` and `?place=` runs are artificial
 * (a bot plays, the tower begins part-way up, or the team is hand-picked), so they leave the save
 * alone; `?tutorial=`, `?seed=` and `?debug` runs are normal play and count.
 */
export function savesRun(params: DebugParams): boolean {
  return (
    params.bot === undefined &&
    params.start === undefined &&
    params.team === undefined &&
    params.level === undefined &&
    params.weather === undefined &&
    params.place === undefined
  );
}

/** The address with `?reset=1` taken out, so a reload does not reset the save again. */
export function withoutReset(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('reset');
  return url.toString();
}
