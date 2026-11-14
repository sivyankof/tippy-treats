/** The "Try it" demo of a creature card (docs/07-ui-screens.md, section 8). */
export const DEMO = {
  /** Ready layers under the first flying one: the creature layer comes next (index 6). */
  startHeight: 5,
  /** The demo ends once this many layers are placed after the start, or on a miss. */
  drops: 8,
  /** Pause on the finished tower before the card comes back. */
  endDelayMs: 900,
} as const;
