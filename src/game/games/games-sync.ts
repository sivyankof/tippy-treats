import { achievementPercents, risenAchievements } from '../../core/progression/achievements';
import { boardScores, newScores, sentKey } from '../../core/progression/leaderboards';
import type { Save } from '../../core/save/schema';
import type { GamesService } from '../../services/games/types';

export interface GamesSyncDeps {
  games: GamesService;
  /** The save as it is now. */
  save: () => Readonly<Save>;
  /** Subscribes to every run that reached the save. */
  onRun: (listener: () => void) => () => void;
  /** The current UTC day, `YYYY-MM-DD`. */
  utcToday: () => string;
}

/**
 * Sends the scores and the achievements of the save to the game services (docs/04-meta-retention.md,
 * section 13): when the player becomes signed in and after every run that reached the save. Only
 * what grew since the last send of this launch goes; the platform keeps the best anyway.
 */
export class GamesSync {
  private readonly sentScores = new Map<string, number>();
  private readonly reported = new Map<string, number>();
  private readonly offs: Array<() => void> = [];

  constructor(private readonly deps: GamesSyncDeps) {}

  bind(): void {
    if (this.offs.length > 0) return;
    this.offs.push(
      this.deps.games.onStatus((status) => {
        if (status === 'signed_in') this.push();
      }),
      this.deps.onRun(() => this.push()),
    );
    this.push();
  }

  unbind(): void {
    for (const off of this.offs.splice(0)) off();
  }

  /** Sends what grew, if signed in. */
  push(): void {
    const { games } = this.deps;
    if (games.status() !== 'signed_in') return;
    const save = this.deps.save();
    const day = this.deps.utcToday();
    for (const score of newScores(boardScores(save, day), this.sentScores, day)) {
      this.sentScores.set(sentKey(score.board, day), score.value);
      void games.submitScore(score.board, score.value);
    }
    const risen = risenAchievements(achievementPercents(save), this.reported);
    if (risen.length === 0) return;
    for (const item of risen) this.reported.set(item.id, item.percent);
    void games.reportAchievements(risen);
  }
}
