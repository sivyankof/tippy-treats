import { ANIM } from '../common/anim';
import { HUD_LAYOUT } from '../run/hud-layout';
import { MENU } from '../common/menu-layout';
import { LAP_PLATE } from './space-planets';

const TILT_DEG = -2;
const SWAY_DEG = 1.2;
/** How far the soft shadow of the card plate reaches below its body. */
const SHADOW_REACH = MENU.style.looks.card.shadowOffset + MENU.style.looks.card.shadowBlur;

/** Lowest screen y a hanging plate may reach: the flying layer starts below it (see GameScene.targetScrollY). */
const LOWEST_EDGE_Y = HUD_LAYOUT.bottomEdge + ANIM.camera.hudClearance;

/**
 * A plate that drops in from the top with `backOut` in 300 ms, hangs and leaves upwards: the zone
 * plate and the shorter lap plate share the motion and differ in size and hang time.
 */
function plateSpec(size: {
  width: number;
  height: number;
  fontSize: number;
  labelPad: number;
  holdMs: number;
  /** Hang against the left edge at this distance from it instead of centring. */
  leftMargin?: number;
}) {
  /** Extra drop of a plate corner at the steepest tilt of the sway. */
  const tiltDrop = Math.ceil(
    Math.sin(((Math.abs(TILT_DEG) + SWAY_DEG) * Math.PI) / 180) * (size.width / 2),
  );
  return {
    ...size,
    shadowReach: SHADOW_REACH,
    /**
     * Centre y while it hangs. The plate stays inside the HUD band, so the flying layer
     * (which may be a rush layer with its wind-up) is never covered; it hangs over the badge row.
     */
    restY: LOWEST_EDGE_Y - size.height / 2 - SHADOW_REACH - tiltDrop,
    lowestEdgeY: LOWEST_EDGE_Y,
    tiltDrop,
    inMs: 300,
    inEase: 'Back.easeOut',
    outMs: 260,
    outEase: 'Quad.easeIn',
    /** A slight tilt, in degrees, like a hanging sign. */
    tiltDeg: TILT_DEG,
    /** The plate sways around its tilt while it hangs. */
    swayDeg: SWAY_DEG,
    swayMs: 900,
  } as const;
}

export type PlateSpec = ReturnType<typeof plateSpec>;

/** The plate that announces a new zone (docs/06, "Смена зоны"). `labelPad` is the room between the name and the ends. */
export const ZONE_BANNER = plateSpec({
  width: 660,
  height: 132,
  fontSize: 72,
  labelPad: 40,
  holdMs: 1200,
});

/** The plate "Lap N" (docs/06, "Смена зоны"): the same plate, shorter and a little quicker. */
export const LAP_BANNER = plateSpec({
  width: LAP_PLATE.width,
  height: LAP_PLATE.height,
  fontSize: LAP_PLATE.fontSize,
  labelPad: LAP_PLATE.labelPad,
  holdMs: LAP_PLATE.holdMs,
  leftMargin: LAP_PLATE.leftMargin,
});
