import {
  checkpointRunAllowed,
  checkpointStartWidth,
  isCheckpointHeight,
  type CheckpointHeight,
} from '../../core/zones/checkpoints';
import { dailySeed, dailyTeam } from '../../core/progression/daily';
import type { RunLook } from '../../core/weather/run-look';
import type { RunMode } from '../../core/run/run-result';
import type { RunGoal } from '../../core/run/result-goal';
import type { TeamSlot } from '../../core/tower/sim-types';
import { DEMO } from '../../data/run/demo';
import { gameState } from '../../state';
import { now } from '../../util/clock';
import { utcDay } from '../../util/calendar';
import { readDebugParams, savesRun, skipsTutorial } from '../../util/debug-params';
import { randomSeed } from '../../util/math';
import { hasDebugTeam, resolveRunTeam } from '../debug/debug-team';
import type { DropDriver } from '../perf/perf-drivers';
import { perfRunSetup, perfSession } from '../perf/perf-session';
import { chooseRunLook } from '../weather/run-look-choice';
import { goalsFromSave } from './run-goals';
import { demoTeam, type RunRequest } from './run-request';
import { TUTORIAL_TEAM } from '../tutorial/tutorial-team';

/** Everything the game scene needs to start a run. */
export interface RunSetup {
  request: RunRequest;
  mode: RunMode;
  seed: number;
  startHeight: number;
  /** Width of the first layer above `startHeight` (`TowerSim` config); absent: the first width. */
  startWidth?: number;
  /** The checkpoint the player chose to start from; null for the zero start, `?start=`, the daily tower and demos. */
  checkpoint: CheckpointHeight | null;
  /** A rewarded ad paid for the checkpoint start of this run (true only when it really starts there). */
  paidByAd: boolean;
  team: Array<TeamSlot | null>;
  /** The run is the tutorial run (the hints director decides what it shows). */
  tutorialRun: boolean;
  /** Hints are shown at all: false for demos and hand-picked dev runs. */
  hints: boolean;
  /** False for `?bot=`, `?start=` and demo runs: nothing of them reaches the save. */
  writesSave: boolean;
  /** The run ends without the "Continue?" window (a bot or a demo has nobody to answer it). */
  noContinue: boolean;
  /** Timing deviation of the dev bot player, if one plays. */
  bot: number | undefined;
  /** The result lines the run shows, ascending; empty for the tutorial, the first runs and demos. */
  goals: RunGoal[];
  /** Weather and start place of the run: cosmetic only, never saved. */
  look: RunLook;
  /** Drops the layers of a `?perf=1` benchmark run (it replaces the bot); absent in every other run. */
  perfDriver?: DropDriver;
}

/**
 * Decides the run: the daily tower plays the seed and the team of the UTC day with no hints and no continue; a demo plays its creature in every slot without rewards; the tutorial run
 * has its own team; otherwise the team of the save, which `?team=` / `?level=` (or the debug
 * panel) override in dev builds.
 */
export function setupRun(request: RunRequest): RunSetup {
  const perf = perfRunSetup(request);
  if (perf) return perf;
  const debug = readDebugParams();
  const seed = debug.seed ?? randomSeed();
  if (request.kind === 'daily') {
    const day = utcDay(now());
    const daySeed = dailySeed(day);
    return {
      request,
      mode: 'daily',
      seed: daySeed,
      look: chooseRunLook({ seed: daySeed, daily: true, debug }),
      startHeight: 0,
      goals: goalsFromSave(gameState.data, now(), {
        mode: 'daily',
        tutorial: false,
        startHeight: 0,
      }),
      checkpoint: null,
      paidByAd: false,
      team: dailyTeam(day),
      tutorialRun: false,
      hints: false,
      // A pinned weather or place is a dev view, not the real tower of the day.
      writesSave: debug.weather === undefined && debug.place === undefined,
      noContinue: true,
      bot: undefined,
    };
  }
  if (request.kind === 'demo') {
    return {
      request,
      mode: 'classic',
      seed,
      look: chooseRunLook({ seed, debug }),
      startHeight: DEMO.startHeight,
      goals: [],
      checkpoint: null,
      paidByAd: false,
      team: demoTeam(request.creature, request.level),
      tutorialRun: false,
      hints: false,
      writesSave: false,
      noContinue: true,
      bot: undefined,
    };
  }
  // A run with a hand-picked team, level, bot or start is a normal run: it neither shows the
  // hints nor uses up the tutorial.
  const hints = !skipsTutorial(debug);
  const tutorialRun = hints && gameState.beginRun(debug.tutorial);
  const team = tutorialRun
    ? [...TUTORIAL_TEAM]
    : resolveRunTeam(gameState.data.team, gameState.runTeam());
  const checkpoint = chosenCheckpoint(request, tutorialRun);
  const startHeight = checkpoint ?? debug.start ?? 0;
  return {
    request,
    mode: 'classic',
    seed,
    look: chooseRunLook({ seed, tutorial: tutorialRun, debug }),
    startHeight,
    goals: goalsFromSave(gameState.data, now(), {
      mode: 'classic',
      tutorial: tutorialRun,
      startHeight,
    }),
    // A debug start at a checkpoint height looks exactly like a checkpoint start.
    startWidth:
      checkpoint === null ? debugStartWidth(debug.start) : checkpointStartWidth(checkpoint),
    checkpoint,
    paidByAd: checkpoint !== null && request.kind === 'classic' && request.paidByAd === true,
    team,
    tutorialRun,
    hints,
    // A team picked in the debug panel is as artificial as `?team=`.
    writesSave: savesRun(debug) && !hasDebugTeam(),
    noContinue: debug.bot !== undefined,
    bot: debug.bot,
  };
}

/** The checkpoint of the request when this run may start from it (not the tutorial run). */
function chosenCheckpoint(request: RunRequest, tutorialRun: boolean): CheckpointHeight | null {
  if (request.kind !== 'classic' || request.checkpoint === undefined) return null;
  return checkpointRunAllowed('classic', tutorialRun) ? request.checkpoint : null;
}

/** `?start=` at a checkpoint height takes the checkpoint width; any other height keeps the first width. */
function debugStartWidth(start: number | undefined): number | undefined {
  return start !== undefined && isCheckpointHeight(start) ? checkpointStartWidth(start) : undefined;
}

/** True when the page was opened for a run straight away (dev parameters), not for Home. */
export function opensWithRun(): boolean {
  const debug = readDebugParams();
  return (
    perfSession() !== null ||
    debug.team !== undefined ||
    debug.level !== undefined ||
    debug.bot !== undefined ||
    debug.start !== undefined ||
    debug.tutorial !== undefined ||
    debug.seed !== undefined
  );
}
