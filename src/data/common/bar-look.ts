/**
 * The look of progress bars, arcs and timers (docs/06-art-animation-audio.md, section 6). One set of
 * numbers for every bar of the game: the baker level bar, missions, the oven, the wobble meter
 * and the ring timer of the "Continue?" window all draw through `ui/style/volume-bar.ts`.
 */
export const BAR_LOOK = {
  /** The shade tone along the bottom of a fill: its share of the height and how much darker it is. */
  shade: { share: 0.3, amount: -0.2 },
  /** The rounded ends of a fill's lit face are traced in chords of about this length (px). */
  curveStepPx: 2,
  /** A white strip along the top of a fill: opacity, distance from the top and height (shares of the fill height). */
  gloss: { alpha: 0.42, insetShare: 0.16, share: 0.26 },
  /** The upper half of an empty track is darkened by this much, like a groove. */
  groove: -0.12,
  /** A ring (arc) timer: the same layers measured in shares of the ring width. */
  arc: {
    /** Dark outline on each side of the ring, in pixels. */
    outline: 5,
    /** Share of the ring width the shade tone takes on the inner edge. */
    shadeShare: 0.3,
    /** The gloss stripe: opacity, share of the ring width, and its distance from the outer edge (share). */
    gloss: { alpha: 0.42, share: 0.2, inset: 0.14 },
  },
} as const;
