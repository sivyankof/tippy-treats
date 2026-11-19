import { BALANCE } from '../../../data/tower/balance';
import { GROWN_LOOKS } from '../../../data/creatures/mastery-look';

/** A point in layer pixels, measured from the centre of the layer body. */
export interface Anchor {
  x: number;
  y: number;
}

const HALF_HEIGHT = BALANCE.layer.height / 2;

/** Where a stand-up detail (a sparkler, a lollipop, an umbrella) stands: right of the centre, kept off the edge. */
export function standX(width: number, share: number, minFromEdge: number): number {
  return Math.max(0, Math.min((width / 2) * share, width / 2 - minFromEdge));
}

/** The glowing tip of the sparkler of a grown Sprinkle (the spark sprite sits on it). */
export function sparklerTip(width: number): Anchor {
  const { stand, stick } = GROWN_LOOKS.sprinkle;
  return {
    x: standX(width, stand.share, stand.minFromEdge) + stick.lean,
    y: -HALF_HEIGHT - stick.up,
  };
}
