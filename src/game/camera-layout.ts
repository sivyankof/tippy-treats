import { ANIM } from '../data/anim';
import { BALANCE } from '../data/balance';

/**
 * How far above the top of the tower the flying layer reaches: the gap it starts in, its own
 * height and the bob. The camera keeps this row below the HUD; hints keep out of it.
 */
export const FLYING_REACH =
  BALANCE.layer.gapAboveTower + BALANCE.layer.height + ANIM.flying.bobAmplitude;
