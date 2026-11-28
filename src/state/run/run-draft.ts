// The draft of a running run kept beside the save while the app is in the background
// (docs/08-architecture.md, section 5): the system may unload the app there without a `pagehide`.
import type { RunEndReason, RunMode, RunResult } from '../../core/run/run-result';
import type { Save } from '../../core/save/schema';
import type { RunExtras } from '../run-progress';

/** A run left in the background: recorded as a quit at the next launch if the save still matches. */
export interface RunDraft {
  v: 1;
  result: RunResult;
  extras: RunExtras;
  startHeight: number;
  /** UTC day the daily attempt of the run started on; '' for a classic run. */
  attemptDay: string;
  /** The save the run belongs to: its install, its creation and the runs finished before it. */
  installId: string;
  createdAt: number;
  runsBefore: number;
}

const MODES: readonly RunMode[] = ['classic', 'daily'];
const REASONS: readonly RunEndReason[] = ['miss', 'sneeze', 'quit'];
const RESULT_COUNTS = [
  'seed',
  'height',
  'score',
  'coins',
  'berries',
  'perfects',
  'bestCombo',
  'continuesUsed',
  'zoneIndex',
  'durationMs',
] as const;
const EXTRA_COUNTS = ['floatingCoins', 'abilities', 'maxWobble', 'flies'] as const;

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** The draft of the run `result` of the save `save`. */
export function makeRunDraft(
  save: Readonly<Save>,
  result: RunResult,
  startHeight: number,
  extras: RunExtras,
  attemptDay: string,
): RunDraft {
  return {
    v: 1,
    result: { ...result },
    // The dev tally of coin sources is not needed to record the run.
    extras: {
      floatingCoins: extras.floatingCoins,
      abilities: extras.abilities,
      maxWobble: extras.maxWobble,
      flies: extras.flies,
    },
    startHeight,
    attemptDay,
    installId: save.installId,
    createdAt: save.createdAt,
    runsBefore: save.stats.runs,
  };
}

function readResult(raw: unknown): RunResult | null {
  if (!isObj(raw)) return null;
  if (!RESULT_COUNTS.every((key) => isCount(raw[key]))) return null;
  if (!MODES.includes(raw.mode as RunMode) || !REASONS.includes(raw.endReason as RunEndReason)) {
    return null;
  }
  const result = { mode: raw.mode as RunMode, endReason: raw.endReason as RunEndReason };
  for (const key of RESULT_COUNTS) Object.assign(result, { [key]: Math.floor(raw[key] as number) });
  return result as RunResult;
}

function readExtras(raw: unknown): RunExtras | null {
  if (!isObj(raw) || !EXTRA_COUNTS.every((key) => isCount(raw[key]))) return null;
  return {
    floatingCoins: Math.floor(raw.floatingCoins as number),
    abilities: Math.floor(raw.abilities as number),
    maxWobble: raw.maxWobble as number,
    flies: Math.floor(raw.flies as number),
  };
}

/** The draft in `text`; null when there is none or it cannot be read whole. */
export function readRunDraft(text: string | null): RunDraft | null {
  if (text === null || text === '') return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isObj(raw) || raw.v !== 1) return null;
  const result = readResult(raw.result);
  const extras = readExtras(raw.extras);
  const { startHeight, attemptDay, installId, createdAt, runsBefore } = raw;
  if (
    result === null ||
    extras === null ||
    !isCount(startHeight) ||
    typeof attemptDay !== 'string' ||
    typeof installId !== 'string' ||
    !isCount(createdAt) ||
    !isCount(runsBefore)
  ) {
    return null;
  }
  return { v: 1, result, extras, startHeight, attemptDay, installId, createdAt, runsBefore };
}

/**
 * The draft belongs to `save` as it is now: the same install and save, and no run recorded since
 * (a run recorded in the end, a reset or a cloud copy taken all leave it behind).
 */
export function draftMatches(draft: RunDraft, save: Readonly<Save>): boolean {
  return (
    draft.installId === save.installId &&
    draft.createdAt === save.createdAt &&
    draft.runsBefore === save.stats.runs
  );
}
