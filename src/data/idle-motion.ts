/**
 * Idle motion of the run screen (docs/06-art-animation-audio.md, section 10): nothing on it
 * stands still for more than 2 seconds. Every object gets a quiet continuous sway of its own,
 * a sine with a period of at most `MAX_IDLE_PERIOD_MS`, offset in phase so neighbours do not
 * move in step. Amplitudes are tiny: the HUD stays readable.
 */

/** The longest period an idle motion may have, ms (the "no still object" limit). */
export const MAX_IDLE_PERIOD_MS = 2000;

/** A quiet sway: scale and angle in quadrature, a slow bob in between. */
export interface IdleSpec {
  /** Horizontal and vertical scale amplitude, as a share of the size. */
  scaleX: number;
  scaleY: number;
  /** Rotation amplitude, degrees. */
  angleDeg: number;
  /** Vertical bob amplitude, logical pixels. */
  bobPx: number;
  periodMs: number;
}

/** Phase offsets in radians: objects of the same kind use different ones. */
export const IDLE_PHASE = {
  height: 0,
  score: 2.1,
  label: 4.0,
  plate: 1.3,
  gauge: 3.2,
  next: 0.9,
  nextLabel: 5.1,
  tray: 2.7,
  /** Added per effect badge slot. */
  badgeStep: 1.9,
} as const;

export const IDLE_MOTION = {
  /** Height and score numbers: a gentle breath and a hair of tilt. */
  hudNumber: { scaleX: 0.012, scaleY: 0.012, angleDeg: 0.7, bobPx: 0, periodMs: 1900 },
  /** "Wobble" label, the plate behind it and the gauge. */
  wobbleLabel: { scaleX: 0.025, scaleY: 0.025, angleDeg: 0.8, bobPx: 0, periodMs: 1700 },
  wobblePlate: { scaleX: 0.006, scaleY: 0.03, angleDeg: 0, bobPx: 0, periodMs: 1800 },
  wobbleGauge: { scaleX: 0.01, scaleY: 0.06, angleDeg: 0, bobPx: 0, periodMs: 1600 },
  /** Effect badges and the next-creature indicator rock and bob a little. */
  badge: { scaleX: 0, scaleY: 0, angleDeg: 3, bobPx: 3, periodMs: 1700 },
  nextIcon: { scaleX: 0, scaleY: 0, angleDeg: 2.5, bobPx: 3, periodMs: 1800 },
  nextLabel: { scaleX: 0, scaleY: 0, angleDeg: 0.8, bobPx: 2, periodMs: 1600 },
  /** The tray settles under the tower's weight and back. */
  tray: { scaleX: 0.003, scaleY: 0.02, angleDeg: 0, bobPx: 0, periodMs: 1900 },
  /** Every placed layer: a tiny breathing squash around its bottom edge (phase per layer index). */
  layer: { scaleX: 0.004, scaleY: 0.012, angleDeg: 0, bobPx: 0, periodMs: 1700 },
} as const satisfies Record<string, IdleSpec>;

/** How far the channels of one sway run out of step, radians (scale Y, angle, bob versus scale X). */
export const IDLE_CHANNEL_LAG = { scaleY: 0.8, angle: Math.PI / 2, bob: 2.0 } as const;

/** The shadow the flying layer throws on the tower breathes in strength. */
export const HINT_PULSE = { amount: 0.25, periodMs: 700 } as const;

/** A sheen runs over the tray every `everyMs`. */
export const TRAY_SHEEN = { everyMs: 2600, durationMs: 700, alpha: 0.45, inset: 6 } as const;
