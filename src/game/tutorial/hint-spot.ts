import { TUTORIAL_ANIM } from '../../data/tutorial/tutorial-anim';

const { gap, screenMargin } = TUTORIAL_ANIM.hintSpot;

/** An axis-aligned screen rectangle. */
export interface SpotRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** What `pickPlateY` looks at; every rectangle is in screen pixels. */
export interface SpotInput {
  screenHeight: number;
  /** Lowest y the HUD reaches. */
  hudBottom: number;
  /** Plate size and the x of its centre. */
  plateWidth: number;
  plateHeight: number;
  centerX: number;
  /** Top layer of the tower. */
  topLayer: SpotRect;
  /** Band the flying layer sweeps. */
  flightRow: SpotRect;
  /** Shadow hint on the top layer, `null` while there is none. */
  shadow: SpotRect | null;
}

/** True when the plate (top `top`, gap included) comes within `gap` of the rectangle. */
function crosses(input: SpotInput, top: number, rect: SpotRect): boolean {
  const half = input.plateWidth / 2;
  return (
    input.centerX + half > rect.left - gap &&
    input.centerX - half < rect.right + gap &&
    top + input.plateHeight > rect.top - gap &&
    top < rect.bottom + gap
  );
}

function isFree(input: SpotInput, top: number): boolean {
  if (top + input.plateHeight > input.screenHeight - screenMargin) return false;
  return !(
    crosses(input, top, input.topLayer) ||
    crosses(input, top, input.flightRow) ||
    (input.shadow !== null && crosses(input, top, input.shadow))
  );
}

/**
 * Centre y of a hint plate. Free zones in order: right under the HUD, then under the top layer
 * of the tower (the lower third of the screen when the tower is low). When neither is free (a
 * very short screen) the plate sits at the bottom of the screen.
 */
export function pickPlateY(input: SpotInput): number {
  const underHud = input.hudBottom + gap;
  if (isFree(input, underHud)) return underHud + input.plateHeight / 2;
  const underTower = input.topLayer.bottom + gap;
  if (isFree(input, underTower)) return underTower + input.plateHeight / 2;
  return input.screenHeight - screenMargin - input.plateHeight / 2;
}
