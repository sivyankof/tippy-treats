import { ANIM } from '../../../data/common/anim';
import { HUD_LAYOUT } from '../../../data/run/hud-layout';
import { SHOP_LOOK, WALL_LOOK } from '../../../data/weather/window-look';

/** Lowest point (px from the top of the screen, on the zone's first frame) of the awning and the lamps, with the bob of the awning. */
export function hangBottom(): number {
  const { awning, lamp } = SHOP_LOOK;
  const awningBottom = awning.height + awning.bobPx;
  const lampBottoms = lamp.items.map(
    (item) => awning.height - lamp.tuckPx + item.drop + lamp.height * lamp.scale,
  );
  return Math.max(awningBottom, ...lampBottoms);
}

/** How far the wall has moved down when the run's drop-in has settled: the view the player starts on. */
export function hangRestDown(): number {
  return ANIM.ui.transition.distance * (ANIM.parallax[WALL_LOOK.layer] ?? 1);
}

/** Scroll (px of the wall) at which they are fully gone: their lowest point `clearPx` above the wobble plate. */
export function hangFadeEnd(): number {
  return HUD_LAYOUT.wobblePlate.y - SHOP_LOOK.hang.clearPx - hangBottom();
}

/** The fade runs from here to `FADE_END` (worked out once: `hangAlpha` is called every frame). */
const FADE_FROM = hangRestDown() + SHOP_LOOK.hang.settlePx;
const FADE_END = hangFadeEnd();

/**
 * Alpha factor of the awning and the lamps after the wall has carried them `down` px: 1 on the start view (and the
 * drop-in that settles on it), a smooth fall to 0 at `hangFadeEnd`, 0 beyond. A pure function of the distance, the same
 * on every screen height; if the start view were already past the end they would never show.
 */
export function hangAlpha(down: number): number {
  if (down <= FADE_FROM) return FADE_END > FADE_FROM ? 1 : 0;
  if (down >= FADE_END) return 0;
  const t = (down - FADE_FROM) / (FADE_END - FADE_FROM);
  return 1 - t * t * (3 - 2 * t);
}
