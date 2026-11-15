import type * as Phaser from 'phaser';
import type { CheckpointHeight } from '../core/checkpoints';
import type { RunResult } from '../core/run-result';
import type { RunTally } from '../core/run-tally';
import type { CreatureId } from '../data/creatures';
import type { RunSummary } from '../state/game-state';
import type { TowerSnapshot } from './objects/tower-snapshot';
import { gameState } from '../state';
import { CLASSIC_RUN, type DemoBack, type RunRequest } from './run-request';
import { decideRestart } from './run-restart';

export const SCENES = {
  boot: 'boot',
  home: 'home',
  team: 'team',
  collection: 'collection',
  creatureDetail: 'creature_detail',
  daily: 'daily',
  shop: 'shop',
  newCreature: 'new_creature',
  game: 'game',
  hud: 'hud',
  results: 'results',
  lineup: 'lineup',
  artSheet: 'art_sheet',
} as const;

export type SceneKey = (typeof SCENES)[keyof typeof SCENES];

/** Data handed to the results scene when it is launched. */
export interface ResultsData {
  result: RunResult;
  /** What the run changed in the save; the run is already recorded when the screen opens. */
  summary: RunSummary;
  /** Coins by source and abilities of the run. */
  tally: RunTally;
  /** The run reached the save (false for dev bot and start-height runs). */
  recorded: boolean;
  /** The finished tower, for the picture of "Share". */
  tower: TowerSnapshot;
  /** Height the run began from (0, a checkpoint or a dev start); layers up to it were not placed. */
  startHeight: number;
  /** The checkpoint the player chose, or null for the zero start (and every unpaid dev start). */
  checkpoint: CheckpointHeight | null;
}

/** Screens a creature card can return to (equal to the keys of the collection and team scenes). */
export type DetailBack = DemoBack;

export interface CreatureDetailData {
  id: CreatureId;
  back: DetailBack;
}

/** Where to go after a screen that shows something and then gets out of the way. */
export type NextStep =
  { kind: 'screen'; key: SceneKey; data?: object } | { kind: 'run'; request: RunRequest };

export interface NewCreatureData {
  /** Creatures to present one after another. */
  creatures: CreatureId[];
  then: NextStep;
  /** Highlight "Play" on Home when it comes next (the end of the tutorial). */
  firstHome?: boolean;
}

export interface HomeData {
  /** Highlight "Play" right after the tutorial. */
  highlightPlay?: boolean;
  /** Open the settings window right away (the screen was rebuilt after a language change). */
  reopenSettings?: boolean;
}

/** The scenes of a run; a menu screen replaces them. */
const RUN_SCENES: readonly SceneKey[] = [SCENES.game, SCENES.hud, SCENES.results];

/**
 * Starts a fresh run: launching a running scene restarts it. A scene cannot launch
 * itself (Phaser ignores it), so the calling scene restarts instead.
 */
export function launchRun(scene: Phaser.Scene, request: RunRequest = CLASSIC_RUN): void {
  for (const key of [SCENES.game, SCENES.hud]) {
    if (key === scene.scene.key) scene.scene.restart(request);
    else scene.scene.launch(key, request);
  }
}

/**
 * Restarts the current run (pause, page cache restore): a daily run spends an attempt first, and
 * with none left the daily screen opens instead.
 */
export function restartRun(scene: Phaser.Scene, request: RunRequest = CLASSIC_RUN): void {
  if (decideRestart(request, () => gameState.startDailyAttempt()) === 'run') {
    launchRun(scene, request);
  } else {
    openScreen(scene, SCENES.daily);
  }
}

/** A menu screen starts a run and goes away. */
export function startRunFrom(scene: Phaser.Scene, request: RunRequest = CLASSIC_RUN): void {
  launchRun(scene, request);
  scene.scene.stop();
}

/**
 * Replaces the calling screen (and a run under it) with another screen. Phaser keeps the data of
 * the previous start when a scene is started without any, so a one-off flag (Home's
 * `reopenSettings` after a language change, `highlightPlay`) would come back on every later visit:
 * a screen opened without data always gets a fresh empty object.
 */
export function openScreen(scene: Phaser.Scene, key: SceneKey, data: object = {}): void {
  for (const runKey of RUN_SCENES) {
    if (runKey === scene.scene.key) continue;
    if (scene.scene.isActive(runKey) || scene.scene.isPaused(runKey)) scene.scene.stop(runKey);
  }
  scene.scene.start(key, data);
}

/** Follows a `NextStep` from the calling screen. */
export function goNext(scene: Phaser.Scene, next: NextStep): void {
  if (next.kind === 'run') startRunFrom(scene, next.request);
  else openScreen(scene, next.key, next.data);
}
