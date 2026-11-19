import type * as Phaser from 'phaser';
import { MENU } from '../../data/common/menu-layout';
import { PALETTE } from '../../data/common/palette';
import { createIconButton } from '../ui/menu/icon-button';
import { createNoAdsIcon } from '../ui/menu/shop-premium-icon';
import { GROWN_PICTURES } from './art-sheet-grown';

/** A picture that is built from drawing calls instead of a texture: a name and a factory. */
export interface LivePicture {
  name: string;
  /** Size it is built at; `ART_SHEET.liveSize` when left out. */
  size?: number;
  /** Builds the picture about `size` pixels across, centred on its own origin. */
  create: (scene: Phaser.Scene, size: number) => Phaser.GameObjects.Container;
}

/** Pictures with no texture of their own that still belong on the art sheet; a new one needs one line. */
export const LIVE_PICTURES: readonly LivePicture[] = [
  { name: 'no_ads_icon', create: createNoAdsIcon },
  {
    name: 'about_bubble_icon',
    create: (scene, size) => {
      const { size: buttonSize } = MENU.detail.about;
      const button = createIconButton(
        scene,
        0,
        0,
        buttonSize,
        PALETTE.accentSecondary,
        'about',
        () => undefined,
      );
      return scene.add.container(0, 0, [button]).setScale(size / buttonSize);
    },
  },
  ...GROWN_PICTURES,
];
