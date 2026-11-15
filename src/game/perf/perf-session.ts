import { checkpointStartWidth, isCheckpointHeight } from '../../core/checkpoints';
import { PERF, PERF_SEGMENTS, type PerfSegmentDef, type PerfSegmentId } from '../../data/perf';
import type { ReducedFxSetting } from '../../core/save/schema';
import type { PerfParams } from '../../util/debug-params';
import { toTeamSlots } from '../debug/debug-team';
import { effectsMode } from '../effects-mode';
import type { RunRequest } from '../run-request';
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
  /** The player's effects choice before the benchmark pinned its own, put back at the end. */
  readonly savedChoice: ReducedFxSetting;
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
 * "fewer effects" switch cannot change what is measured. Call before the game is created.
 */
export function beginPerfSession(params: PerfParams): PerfSession {
  const savedChoice = effectsMode.getChoice();
  effectsMode.setChoice(params.fx === 'reduced' ? 'on' : 'off');
  session = { params, ids: idsOf(params), index: 0, runsStarted: 0, driver: null, savedChoice };
  return session;
}

/** Puts the player's effects choice back; the benchmark is over. */
export function endPerfSession(): void {
  if (session) effectsMode.setChoice(session.savedChoice);
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
    startHeight: def.start,
    startWidth: isCheckpointHeight(def.start) ? checkpointStartWidth(def.start) : undefined,
    checkpoint: null,
    paidByAd: false,
    team: toTeamSlots(def.team, def.level),
    tutorialRun: false,
    hints: false,
    writesSave: false,
    noContinue: true,
    bot: undefined,
    perfDriver: driver,
  };
}

/** The results of a benchmark run: shown as if saved, with the fresh oven of the screen (the save itself is untouched). */
export function perfResultsData(data: ResultsData): ResultsData {
  const { xpGained, oven } = PERF.results;
  return { ...data, recorded: true, summary: { ...data.summary, xpGained, oven: { ...oven } } };
}
