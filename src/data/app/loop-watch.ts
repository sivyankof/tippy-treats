/** The frame loop watchdog (docs/08-architecture.md, "Сторож цикла кадров"). */
export const LOOP_WATCH = {
  /** How often the watchdog looks at the frame counter. */
  checkMs: 500,
  /**
   * The counter standing still this long on a visible page is a dead loop. A phone that draws
   * even 5 frames a second moves it several times in this span; a long synchronous task (a scene
   * load, a bake) blocks the watchdog's timer as well and is told apart by `lateMs`.
   */
  stallMs: 1500,
  /** A check that came this much later than planned means the page was busy: the count starts over. */
  lateMs: 1000,
  /** Most restarts of one page load; then one report and the watchdog leaves the loop alone. */
  restartsMax: 5,
  /** The least time between two restarts. */
  restartGapMs: 5000,
} as const;
