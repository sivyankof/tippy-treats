import { StatusHub } from './status-hub';
import type { AchievementReport, BoardId, GamesService, GamesStatus } from './types';

/** What the game needs of the app's own plugin `TippyGames` (`ios/App/App/TippyGamesPlugin.swift`). */
export interface GamesPlugin {
  start(): Promise<{ status: string }>;
  signIn(): Promise<{ signedIn: boolean; status: string }>;
  submitScore(options: { board: string; value: number }): Promise<{ ok: boolean }>;
  showBoard(options: { board: string }): Promise<void>;
  reportAchievements(options: { items: AchievementReport[] }): Promise<{ ok: boolean }>;
  showAchievements(): Promise<void>;
  addListener(
    event: 'status',
    listener: (data: { status: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

function asStatus(value: unknown): GamesStatus {
  return value === 'signed_in' || value === 'signed_out' ? value : 'unavailable';
}

/**
 * Game Center through `TippyGames`. Every call is wrapped: a missing plugin, a rejected promise
 * or a throw makes the status `unavailable` (calls that fail while signed in leave it as it is:
 * a lost score is not worth hiding the buttons).
 */
export class NativeGames implements GamesService {
  private readonly hub = new StatusHub('unavailable');
  private starting: Promise<void> | null = null;

  constructor(private readonly plugin: GamesPlugin) {}

  status(): GamesStatus {
    return this.hub.status;
  }

  onStatus(listener: (status: GamesStatus) => void): () => void {
    return this.hub.on(listener);
  }

  start(): Promise<void> {
    this.starting ??= this.begin();
    return this.starting;
  }

  async signIn(): Promise<boolean> {
    await this.start();
    if (this.hub.status === 'unavailable') return false;
    if (this.hub.status === 'signed_in') return true;
    try {
      const result = await this.plugin.signIn();
      const next = asStatus(result.status);
      this.hub.set(next);
      return result.signedIn === true && next === 'signed_in';
    } catch {
      return false;
    }
  }

  submitScore(board: BoardId, value: number): Promise<boolean> {
    return this.delivered(() => this.plugin.submitScore({ board, value }));
  }

  showBoard(board: BoardId): Promise<void> {
    return this.whenSignedIn(() => this.plugin.showBoard({ board }));
  }

  reportAchievements(items: readonly AchievementReport[]): Promise<boolean> {
    if (items.length === 0) return Promise.resolve(true);
    return this.delivered(() => this.plugin.reportAchievements({ items: [...items] }));
  }

  showAchievements(): Promise<void> {
    return this.whenSignedIn(() => this.plugin.showAchievements());
  }

  private async begin(): Promise<void> {
    try {
      // The listener first, so a status the plugin sends while starting is not lost.
      await this.plugin.addListener('status', (data) => this.hub.set(asStatus(data.status)));
      const result = await this.plugin.start();
      this.hub.set(asStatus(result.status));
    } catch {
      this.hub.set('unavailable');
    }
  }

  private async whenSignedIn(call: () => Promise<void>): Promise<void> {
    if (this.hub.status !== 'signed_in') return;
    try {
      await call();
    } catch {
      // A system window that fails to open is not the game's problem.
    }
  }

  /** A send that says whether Game Center took it; any failure is `false`, never a throw. */
  private async delivered(call: () => Promise<{ ok: boolean }>): Promise<boolean> {
    if (this.hub.status !== 'signed_in') return false;
    try {
      return (await call()).ok === true;
    } catch {
      return false;
    }
  }
}
