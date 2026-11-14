import type { TeamSlot } from '../core/sim-types';

/** One-time hints of the first run. */
export const HINT_IDS = ['tutorial', 'tap', 'firstPerfect', 'honey', 'wobble'] as const;
export type HintId = (typeof HINT_IDS)[number];

/** The team of the tutorial run: the starter creature alone in the first slot. */
export const TUTORIAL_TEAM: readonly (TeamSlot | null)[] = [{ id: 'honey', level: 1 }, null, null];

/**
 * Which hints this browser session has shown, kept in memory (the save system of M6 takes
 * these flags over). The first run of a session is the tutorial run.
 */
export class SessionHints {
  private readonly seen = new Set<HintId>();

  has(id: HintId): boolean {
    return this.seen.has(id);
  }

  mark(id: HintId): void {
    this.seen.add(id);
  }

  /**
   * Called when a run starts: true when it is the tutorial run. The tutorial stays pending
   * (restarts included) until the director marks it done: the Honey intro has played, or a run
   * went past the Honey layer. `force` comes from `?tutorial=`:
   * `true` makes every run a tutorial run with all hints fresh, `false` turns every hint off.
   */
  beginRun(force?: boolean): boolean {
    if (force === true) {
      this.seen.clear();
    } else if (force === false) {
      for (const id of HINT_IDS) this.seen.add(id);
    }
    return !this.seen.has('tutorial');
  }
}

/** The hints of the running session. */
export const sessionHints = new SessionHints();
