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
  /** True while nothing may be sent (a debug writer changed the progress in this launch). */
  blocked?: () => boolean;
}

/** Remembers `value` under `key` now; puts the old value back if the send fails and nothing newer came meanwhile. */
function remember(map: Map<string, number>, key: string, value: number): (ok: boolean) => void {
  const before = map.get(key);
  map.set(key, value);
  return (ok) => {
    if (ok || map.get(key) !== value) return;
    if (before === undefined) map.delete(key);
    else map.set(key, before);
  };
}

/**
 * Sends the scores and the achievements of the save to the game services (docs/04-meta-retention.md,
 * section 13): when the player becomes signed in and after every run that reached the save. Only
 * what grew since the last delivered send of this launch goes (a failed send is tried again with
 * the next push); the memory is cleared when the player stops being signed in, so another
 * account signing in gets everything.
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
        else this.forget();
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
    if (games.status() !== 'signed_in' || this.deps.blocked?.()) return;
    const save = this.deps.save();
    const day = this.deps.utcToday();
    for (const score of newScores(boardScores(save, day), this.sentScores, day)) {
      const settle = remember(this.sentScores, sentKey(score.board, day), score.value);
      void games.submitScore(score.board, score.value).then(settle);
    }
    const risen = risenAchievements(achievementPercents(save), this.reported);
    if (risen.length === 0) return;
    const settles = risen.map((item) => remember(this.reported, item.id, item.percent));
    void games.reportAchievements(risen).then((ok) => settles.forEach((settle) => settle(ok)));
  }

  private forget(): void {
    this.sentScores.clear();
    this.reported.clear();
  }
}
