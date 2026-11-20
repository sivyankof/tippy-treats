/** The check of a suspect audio context (services/audio/context-health.ts, docs/06, section 7). */
export const CONTEXT_HEALTH = {
  /** A suspect context is looked at this often, ms. */
  tickMs: 100,
  /** Its clock must keep going this long in a row to count as alive, ms. */
  aliveMs: 200,
  /** "Going": the clock gains at least this share of the time that passed. */
  minRate: 0.5,
  /**
   * What is done, and when (ms after the check began), while the clock still stands: ask it to
   * run, then stop and start it, then make the context again.
   */
  ladder: [
    { atMs: 300, step: 'resume' },
    { atMs: 1000, step: 'resume' },
    { atMs: 2000, step: 'resume' },
    { atMs: 2300, step: 'bounce' },
    { atMs: 2700, step: 'remake' },
  ],
  /**
   * Two steps never come closer than this, ms: a main thread busy loading the game lets several
   * steps fall due at once, and each needs a moment to work.
   */
  minStepGapMs: 250,
  /** At most this many automatic remakes per page. */
  maxRemakes: 3,
} as const;
