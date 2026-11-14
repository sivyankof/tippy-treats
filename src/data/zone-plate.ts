import { ANIM } from './anim';
import { HUD_LAYOUT } from './hud-layout';

const WIDTH = 660;
const HEIGHT = 132;
const SHADOW_OFFSET = 10;
const TILT_DEG = -2;
const SWAY_DEG = 1.2;

/** Lowest screen y a hanging plate may reach: the flying layer starts below it (see GameScene.targetScrollY). */
const LOWEST_EDGE_Y = HUD_LAYOUT.bottomEdge + ANIM.camera.hudClearance;
/** Extra drop of a plate corner at the steepest tilt of the sway. */
const TILT_DROP = Math.ceil(
  Math.sin(((Math.abs(TILT_DEG) + SWAY_DEG) * Math.PI) / 180) * (WIDTH / 2),
);

/**
 * The plate that announces a new zone (docs/06, "Смена зоны"): it drops in from the top
 * with `backOut` in 300 ms, hangs for 1.2 s and leaves upwards.
 */
export const ZONE_BANNER = {
  width: WIDTH,
  height: HEIGHT,
  radius: 46,
  shadowOffset: SHADOW_OFFSET,
  /** Width of the coloured edge inside the plate. */
  edge: 8,
  /** Inset of that edge from the plate border. */
  edgeInset: 14,
  fontSize: 72,
  /**
   * Centre y while it hangs. The plate stays inside the HUD band, so the flying layer
   * (which may be a rush layer with its wind-up) is never covered; it hangs over the badge row.
   */
  restY: LOWEST_EDGE_Y - (HEIGHT + SHADOW_OFFSET) / 2 - TILT_DROP,
  lowestEdgeY: LOWEST_EDGE_Y,
  tiltDrop: TILT_DROP,
  inMs: 300,
  inEase: 'Back.easeOut',
  holdMs: 1200,
  outMs: 260,
  outEase: 'Quad.easeIn',
  /** A slight tilt, in degrees, like a hanging sign. */
  tiltDeg: TILT_DEG,
  /** The plate sways around its tilt while it hangs. */
  swayDeg: SWAY_DEG,
  swayMs: 900,
} as const;
