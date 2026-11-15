import { ANIM } from './anim';
import { HUD_LAYOUT } from './hud-layout';
import { MENU } from './menu-layout';

const WIDTH = 660;
const HEIGHT = 132;
/** How far the soft shadow of the card plate reaches below its body. */
const SHADOW_REACH = MENU.style.looks.card.shadowOffset + MENU.style.looks.card.shadowBlur;
const TILT_DEG = -2;
const SWAY_DEG = 1.2;

/** Lowest screen y a hanging plate may reach: the flying layer starts below it (see GameScene.targetScrollY). */
const LOWEST_EDGE_Y = HUD_LAYOUT.bottomEdge + ANIM.camera.hudClearance;
/** Extra drop of a plate corner at the steepest tilt of the sway. */
const TILT_DROP = Math.ceil(
  Math.sin(((Math.abs(TILT_DEG) + SWAY_DEG) * Math.PI) / 180) * (WIDTH / 2),
);

/**
 * The plate that announces a new zone (docs/06, "Смена зоны"): a card plate of the kit with an
 * accent rim. It drops in from the top with `backOut` in 300 ms, hangs for 1.2 s and leaves
 * upwards.
 */
export const ZONE_BANNER = {
  width: WIDTH,
  height: HEIGHT,
  shadowReach: SHADOW_REACH,
  fontSize: 72,
  /** Room between the name and the ends of the plate. */
  labelPad: 40,
  /**
   * Centre y while it hangs. The plate stays inside the HUD band, so the flying layer
   * (which may be a rush layer with its wind-up) is never covered; it hangs over the badge row.
   */
  restY: LOWEST_EDGE_Y - HEIGHT / 2 - SHADOW_REACH - TILT_DROP,
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
