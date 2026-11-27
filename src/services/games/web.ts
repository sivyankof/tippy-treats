import { StatusHub } from './status-hub';
import type { AchievementReport, BoardId, GamesService, GamesStatus } from './types';

/**
 * Modes of the browser stub (`?games=` on the dev server and the internal build): the three
 * statuses, and `refused` — signed out, and the sign-in fails as after a player once declined.
 */
export type WebGamesMode = GamesStatus | 'refused';

export function isWebGamesMode(value: string | null | undefined): value is WebGamesMode {
  return (
    value === 'unavailable' ||
    value === 'signed_out' ||
    value === 'signed_in' ||
    value === 'refused'
  );
}

/**
 * The browser has no Game Center: `unavailable` unless a debug mode asks otherwise. In a debug
 * mode it plays the service (signing in works at once except in `refused`) and writes every call
 * to `log`.
 */
export class WebGames implements GamesService {
  private readonly hub: StatusHub;
  private started = false;

  constructor(
    private readonly mode: WebGamesMode = 'unavailable',
    private readonly log: ((line: string) => void) | null = null,
  ) {
    this.hub = new StatusHub('unavailable');
  }

  status(): GamesStatus {
    return this.hub.status;
  }

  onStatus(listener: (status: GamesStatus) => void): () => void {
    return this.hub.on(listener);
  }

  start(): Promise<void> {
    if (!this.started) {
      this.started = true;
      this.hub.set(this.mode === 'refused' ? 'signed_out' : this.mode);
      this.note(`start → ${this.hub.status}`);
    }
    return Promise.resolve();
  }

  signIn(): Promise<boolean> {
    if (this.hub.status === 'signed_out' && this.mode !== 'refused') this.hub.set('signed_in');
    this.note(`signIn → ${this.hub.status}`);
    return Promise.resolve(this.hub.status === 'signed_in');
  }

  submitScore(board: BoardId, value: number): Promise<boolean> {
    this.note(`submitScore ${board} ${value}`);
    return Promise.resolve(this.hub.status === 'signed_in');
  }

  showBoard(board: BoardId): Promise<void> {
    this.note(`showBoard ${board}`);
    return Promise.resolve();
  }

  reportAchievements(items: readonly AchievementReport[]): Promise<boolean> {
    this.note(`reportAchievements ${items.map((i) => `${i.id}=${i.percent}`).join(', ')}`);
    return Promise.resolve(this.hub.status === 'signed_in');
  }

  showAchievements(): Promise<void> {
    this.note('showAchievements');
    return Promise.resolve();
  }

  private note(line: string): void {
    if (this.mode !== 'unavailable') this.log?.(`[games] ${line}`);
  }
}
