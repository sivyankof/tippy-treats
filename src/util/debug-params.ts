import { UINT32_RANGE } from './math';

export interface DebugParams {
  debug: boolean;
  /** Fixed run seed (uint32). */
  seed?: number;
  /** Timing deviation of the bot player in milliseconds. */
  bot?: number;
  /** Number of pre-placed layers at the start of a run. */
  start?: number;
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

/** Reads `?debug`, `?seed=`, `?bot=` and `?start=` from a query string. Invalid values are ignored. */
export function parseDebugParams(search: string): DebugParams {
  const params = new URLSearchParams(search);
  const result: DebugParams = { debug: params.has('debug') && params.get('debug') !== '0' };
  const seed = parseUint(params.get('seed'), UINT32_MAX);
  const bot = parsePositive(params.get('bot'));
  const start = parseUint(params.get('start'));
  if (seed !== undefined) result.seed = seed;
  if (bot !== undefined) result.bot = bot;
  if (start !== undefined) result.start = start;
  return result;
}

/** Debug parameters of the current page. They only apply to dev builds. */
export function readDebugParams(): DebugParams {
  return import.meta.env.DEV ? parseDebugParams(window.location.search) : NO_PARAMS;
}
