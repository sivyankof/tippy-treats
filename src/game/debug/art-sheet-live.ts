import type * as Phaser from 'phaser';
import { createNoAdsIcon } from '../ui/menu/shop-premium-icon';

/** A picture that is built from drawing calls instead of a texture: a name and a factory. */
interface LivePicture {
  name: string;
  /** Builds the picture about `size` pixels across, centred on its own origin. */
  create: (scene: Phaser.Scene, size: number) => Phaser.GameObjects.Container;
}

/** Pictures with no texture of their own that still belong on the art sheet; a new one needs one line. */
export const LIVE_PICTURES: readonly LivePicture[] = [
  { name: 'no_ads_icon', create: createNoAdsIcon },
];
