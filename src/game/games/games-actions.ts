import type * as Phaser from 'phaser';
import type { BoardId } from '../../data/games/boards';
import { t } from '../../i18n';
import { services } from '../../services';
import { gameState } from '../../state';
import { utcDay } from '../../util/calendar';
import { now } from '../../util/clock';
import { overridesSave, readDebugParams } from '../../util/debug-params';
import { showToast } from '../ui/style/toast';
import { GamesSync } from './games-sync';
import {
  logAchievementsOpen,
  logBoardOpen,
  logGamesSignIn,
  type SignInSource,
} from './games-telemetry';

let sync: GamesSync | null = null;

/**
 * Ties the game services to the save once per launch (docs/04-meta-retention.md, section 13).
 * Nothing is sent while a debug override writes into the save.
 */
export function bindGames(): void {
  if (sync || overridesSave(readDebugParams())) return;
  sync = new GamesSync({
    games: services.games,
    save: () => gameState.data,
    onRun: (listener) => gameState.onRunRecorded(listener),
    utcToday: () => utcDay(now()),
  });
  sync.bind();
}

/** The quiet sign-in, on Home once the first run is over: nothing covers the first launch and the tutorial. */
export function startGamesOnHome(): void {
  if (gameState.data.tutorial.firstRunDone) void services.games.start();
}

/** The buttons of the game services are there unless the services are unavailable. */
export function gamesShown(): boolean {
  return services.games.status() !== 'unavailable';
}

/**
 * Signs in on the player's tap if needed. When the system offers no window any more (the
 * player once declined), a notice tells where to sign in.
 */
export async function ensureSignedIn(scene: Phaser.Scene, source: SignInSource): Promise<boolean> {
  const games = services.games;
  if (games.status() === 'signed_in') return true;
  if (games.status() === 'unavailable') return false;
  const ok = await games.signIn();
  logGamesSignIn(source, ok);
  if (!ok && scene.sys.isActive()) showToast(scene, t('games.signInHint'));
  return ok;
}

/** The system window of a leaderboard, after a sign-in when needed. */
export async function openBoard(scene: Phaser.Scene, board: BoardId): Promise<void> {
  if (!(await ensureSignedIn(scene, 'board'))) return;
  logBoardOpen(board);
  await services.games.showBoard(board);
}

/** The system window of the achievements, after a sign-in when needed. */
export async function openAchievements(scene: Phaser.Scene): Promise<void> {
  if (!(await ensureSignedIn(scene, 'achievements'))) return;
  logAchievementsOpen();
  await services.games.showAchievements();
}
