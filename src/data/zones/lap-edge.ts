import { BALANCE } from '../tower/balance';

/**
 * The dashed width-cap edges of the later laps of Space (docs/06-art-animation-audio.md, "Правила
 * зон", row "Предел ширины (витки Космоса)"). Durations are milliseconds, distances logical pixels.
 */
export const LAP_EDGE = {
  /** Key of the one baked dash strip on the shared atlas. */
  texture: 'tr_lap_edge',
  /** A light, pale violet of the Space dust: reads on the night sky without a glow. */
  color: 0xd9ccff,
  /** Width of one dash. */
  strokePx: 4,
  /** Dashes per layer height, so the pattern lines up again after every landing. */
  dashesPerLayer: 4,
  /** Share of a dash period that is solid. */
  dashShare: 0.6,
  /** How far the edges reach above the flying row. */
  aboveRowPx: 60,
  /** First lap of Space that shows the edges. */
  firstLap: 2,
  /** Fade in with the first layer of lap 2. */
  fadeInMs: 400,
  /** Slide to the new cap on each new lap. */
  slideMs: 300,
  /** Full and lite effects: the dashes twinkle between these opacities with this period. */
  twinkleAlpha: [0.35, 0.55],
  twinklePeriodMs: 1600,
  /** Minimal effects: static opacity. */
  minimalAlpha: 0.45,
} as const;

/** Height of the baked strip: from the tower top to the top of the flying row and a bit above. */
export const LAP_EDGE_HEIGHT =
  BALANCE.layer.gapAboveTower + BALANCE.layer.height + LAP_EDGE.aboveRowPx;
