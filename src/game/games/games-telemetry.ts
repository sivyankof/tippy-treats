import type { BoardId } from '../../data/games/boards';
import { services } from '../../services';

/** Where the player asked to sign in from. */
export type SignInSource = 'board' | 'achievements' | 'settings';

/** The sign-in the player asked for, and how it ended. */
export function logGamesSignIn(source: SignInSource, ok: boolean): void {
  services.telemetry.logEvent('games_sign_in', { source, result: ok ? 'ok' : 'fail' });
}

export function logBoardOpen(board: BoardId): void {
  services.telemetry.logEvent('games_board_open', { board });
}

export function logAchievementsOpen(): void {
  services.telemetry.logEvent('games_achievements_open');
}
