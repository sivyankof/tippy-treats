import type * as Phaser from 'phaser';
import type { CheckpointHeight, CheckpointRow } from '../../core/zones/checkpoints';
import type { RunResult } from '../../core/run/run-result';
import type { RunTally } from '../../core/run/run-tally';
import type { CreatureId } from '../../data/creatures/creatures';
import type { RunSummary } from '../../state/game-state';
import type { TowerSnapshot } from '../objects/tower/tower-snapshot';
import { gameState } from '../../state';
import { CLASSIC_RUN, type DemoBack, type RunRequest } from '../run/run-request';
import { decideRestart, restartRequest } from '../run/run-restart';

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

/** Where the results screen is: not launched, built hidden while the tower collapses, or on show. */
export function resultsPhase(
  scenes: Pick<Phaser.Scenes.SceneManager, 'isActive' | 'isVisible'>,
): 'none' | 'held' | 'shown' {
  if (!scenes.isActive(SCENES.results)) return 'none';
  return scenes.isVisible(SCENES.results) ? 'shown' : 'held';
}

/** The results screen is on show: a screen that is still building itself hidden does not count. */
export function resultsShown(scenes: Phaser.Scenes.SceneManager): boolean {
  return resultsPhase(scenes) === 'shown';
}

/** What the start buttons of the results offer: the opened checkpoints and the rows of the choice. */
export interface StartOffer {
  opened: readonly CheckpointHeight[];
  /** `adReady`: a rewarded ad is loaded now. */
  rows(adReady: boolean): CheckpointRow[];
}

/** Data handed to the results scene when it is launched. */
export interface ResultsData {
  result: RunResult;
  /** What the run changed in the save; the run is already recorded when the screen opens. */
  summary: RunSummary;
  /** Coins by source and abilities of the run. */
  tally: RunTally;
  /** The run reached the save (false for dev bot and start-height runs). */
  recorded: boolean;
  /** A `?perf=1` benchmark run: shown as if saved, but nothing real (doubling, ads, share, paid starts) may act on it. */
  benchmark?: boolean;
  /** The screen builds itself hidden (while the tower collapses) and waits for `ResultsScene.reveal`. */
  hold?: boolean;
  /** The finished tower, for the picture of "Share". */
  tower: TowerSnapshot;
  /** Height the run began from (0, a checkpoint or a dev start); layers up to it were not placed. */
  startHeight: number;
  /** The checkpoint the player chose, or null for the zero start (and every unpaid dev start). */
  checkpoint: CheckpointHeight | null;
  /** Instead of the save's checkpoints (only the `?resultsDemo` screens set it). */
  startOffer?: StartOffer;
  /** Where the XP bar ends instead of the save's level (only the `?resultsDemo` screens set it). */
  xpEnd?: { level: number; xp: number };
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
 * Restarts the current run (pause, page cache restore): a run from a checkpoint begins from zero, a daily run spends an attempt first, and
 * with none left the daily screen opens instead.
 */
export function restartRun(scene: Phaser.Scene, request: RunRequest = CLASSIC_RUN): void {
  const next = restartRequest(request);
  if (decideRestart(next, () => gameState.startDailyAttempt()) === 'run') {
    launchRun(scene, next);
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
