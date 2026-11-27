import type { BoardId } from '../../data/games/boards';

export type { BoardId };

/** `unavailable`: no Game Center here (browser, Android in 1.1, restricted device); the game hides its buttons. */
export type GamesStatus = 'unavailable' | 'signed_out' | 'signed_in';

/** One achievement's progress, a whole percent 0..100. */
export interface AchievementReport {
  id: string;
  percent: number;
}

/**
 * The platform's game services (Game Center on iOS; docs/09-services-analytics.md, section 13).
 * No method throws: any failure behaves as if there were no game services.
 */
export interface GamesService {
  status(): GamesStatus;
  /** Calls `listener` on every change of the status; returns the unsubscribe. */
  onStatus(listener: (status: GamesStatus) => void): () => void;
  /** The quiet attempt at launch: never opens a system window by itself. Safe to call again. */
  start(): Promise<void>;
  /**
   * On the player's tap: may open the system sign-in window. False when the player is not
   * signed in afterwards, also when the system no longer offers its window (the player once
   * declined: then only Settings › Game Center helps).
   */
  signIn(): Promise<boolean>;
  /** True when Game Center took the score; false when signed out or the send failed. */
  submitScore(board: BoardId, value: number): Promise<boolean>;
  /** The system window of a leaderboard. */
  showBoard(board: BoardId): Promise<void>;
  /** Progress of achievements; the platform keeps the highest it was told. True when it took them. */
  reportAchievements(items: readonly AchievementReport[]): Promise<boolean>;
  /** The system window of the achievements. */
  showAchievements(): Promise<void>;
}
