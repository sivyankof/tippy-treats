import type { TeamSlot } from '../core/sim-types';
import { DEMO } from '../data/demo';
import { gameState } from '../state';
import { readDebugParams, savesRun, skipsTutorial } from '../util/debug-params';
import { randomSeed } from '../util/math';
import { resolveRunTeam } from './debug/debug-team';
import { demoTeam, type RunRequest } from './run-request';
import { TUTORIAL_TEAM } from './tutorial/tutorial-team';

/** Everything the game scene needs to start a run. */
export interface RunSetup {
  request: RunRequest;
  seed: number;
  startHeight: number;
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
}

/**
 * Decides the run: a demo plays its creature in every slot without rewards; the tutorial run
 * has its own team; otherwise the team of the save, which `?team=` / `?level=` (or the debug
 * panel) override in dev builds.
 */
export function setupRun(request: RunRequest): RunSetup {
  const debug = readDebugParams();
  const seed = debug.seed ?? randomSeed();
  if (request.kind === 'demo') {
    return {
      request,
      seed,
      startHeight: DEMO.startHeight,
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
  return {
    request,
    seed,
    startHeight: debug.start ?? 0,
    team,
    tutorialRun,
    hints,
    writesSave: savesRun(debug),
    noContinue: debug.bot !== undefined,
    bot: debug.bot,
  };
}

/** True when the page was opened for a run straight away (dev parameters), not for Home. */
export function opensWithRun(): boolean {
  const debug = readDebugParams();
  return (
    debug.team !== undefined ||
    debug.level !== undefined ||
    debug.bot !== undefined ||
    debug.start !== undefined ||
    debug.tutorial !== undefined ||
    debug.seed !== undefined
  );
}
