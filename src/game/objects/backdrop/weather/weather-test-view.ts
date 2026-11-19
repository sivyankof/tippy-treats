import { FLIGHT_CLEAR } from '../../../../data/backdrop/flight-clear';
import { hudKeepOutFade } from '../../../camera-layout';

/**
 * Whether a weather particle centred at (`x`, `y`) is seen by the player on a screen `height` tall: on the screen and not
 * behind a HUD plate (the particles fall behind the plates). Shared by the tests that count the particles beside the tower.
 */
export function onScreen(x: number, y: number, height: number): boolean {
  return y >= 0 && y <= height && hudKeepOutFade(x, y, -FLIGHT_CLEAR.hudGapPx) > 0;
}
