import type { TeamSlot } from '../../core/sim-types';
import { checkpointStartWidth, isCheckpointHeight } from '../../core/checkpoints';
import { PERF, PERF_SEGMENTS, type PerfSegmentDef, type PerfSegmentId } from '../../data/perf';
import type { PerfParams } from '../../util/debug-params';
import { toTeamSlots } from '../debug/debug-team';
import { effectsMode } from '../effects-mode';
import type { RunRequest } from '../run-request';
import { chooseRunLook } from '../run-look-choice';
import type { RunSetup } from '../run-setup';
import type { ResultsData } from '../scene-keys';
import { createDriver, type DropDriver } from './perf-drivers';

/** What the benchmark is doing right now; lives from the start of the page to the end of the benchmark. */
export interface PerfSession {
  readonly params: PerfParams;
  /** The segments to play, in the order of the benchmark. */
  readonly ids: readonly PerfSegmentId[];
  /** Index into `ids` of the segment whose run is the next to start (or running). */
  index: number;
  /** How many runs the game scene has begun for the benchmark (a run is ready when this reaches `index + 1`). */
  runsStarted: number;
  /** Driver of the running run. */
  driver: DropDriver | null;
}

let session: PerfSession | null = null;

/** The ids to play: `?still=` plays one, `&only=` a subset, otherwise all of them in order. */
function idsOf(params: PerfParams): PerfSegmentId[] {
  if (params.still) return [params.still];
  const all = PERF_SEGMENTS.map((segment) => segment.id);
  return params.only ? all.filter((id) => params.only?.includes(id)) : all;
}

/**
 * Starts the benchmark: pins the effects level in memory only (never saved) so the automatic
 * level steps cannot change what is measured. Call before the game is created.
 */
export function beginPerfSession(params: PerfParams): PerfSession {
  effectsMode.pinLevel(params.fx);
  session = { params, ids: idsOf(params), index: 0, runsStarted: 0, driver: null };
  return session;
}

/** Lets the effects mode decide again; the benchmark is over. */
export function endPerfSession(): void {
  effectsMode.pinLevel(null);
  session = null;
}

/** The benchmark of this page, `null` for a normal start. */
export function perfSession(): PerfSession | null {
  return session;
}

/** The segment whose run is current. */
export function currentSegment(): PerfSegmentDef | null {
  const id = session?.ids[session.index];
  return PERF_SEGMENTS.find((segment) => segment.id === id) ?? null;
}

/** The team of a segment: its own, or with `&mastery=` the mastery team in a segment that has none. */
function perfTeam(def: PerfSegmentDef, mastery: PerfParams['mastery']): Array<TeamSlot | null> {
  if (!mastery || def.team.some((id) => id !== null)) return toTeamSlots(def.team, def.level);
  const level =
    mastery === 'master'
      ? PERF.mastery.levelMaster
      : mastery === 'on'
        ? PERF.mastery.levelOn
        : PERF.mastery.levelOff;
  return toTeamSlots(PERF.mastery.team, level);
}

/**
 * The run of the current segment: fixed seed and tower, no save, no hints, no "Continue?" window.
 * `null` when no benchmark is on.
 */
export function perfRunSetup(request: RunRequest): RunSetup | null {
  const def = currentSegment();
  if (!session || !def) return null;
  const driver = createDriver(def.driver, PERF.seed);
  session.driver = driver;
  session.runsStarted++;
  return {
    request,
    mode: 'classic',
    seed: PERF.seed,
    look: chooseRunLook({
      seed: PERF.seed,
      perf: def.weather ? { ...session.params, weather: def.weather } : session.params,
    }),
    startHeight: def.start,
    startWidth: isCheckpointHeight(def.start) ? checkpointStartWidth(def.start) : undefined,
    checkpoint: null,
    paidByAd: false,
    team: perfTeam(def, session.params.mastery),
    tutorialRun: false,
    hints: false,
    writesSave: false,
    noContinue: true,
    bot: undefined,
    perfDriver: driver,
  };
}

/**
 * The results of a benchmark run: shown as if saved, with the fresh oven of the screen (the save
 * itself is untouched); `benchmark` keeps the doubling, the interstitial, sharing and paid starts off.
 */
export function perfResultsData(data: ResultsData): ResultsData {
  const { xpGained, oven } = PERF.results;
  return {
    ...data,
    recorded: true,
    benchmark: true,
    summary: { ...data.summary, xpGained, oven: { ...oven } },
  };
}
