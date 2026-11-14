import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { createOutlinedText } from '../outlined-text';
import { fitText } from './fit-text';

const cfg = MENU.daily.caption;

/** One block of the daily screen: `root` sits at the middle of the block's top edge. */
export interface DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height: number;
}

/** A caption row above a block: the title on the left and, when given, a gold text on the right. */
export function createCaption(
  scene: Phaser.Scene,
  title: string,
  side?: string,
): Phaser.GameObjects.Container {
  const half = cfg.width / 2;
  const y = cfg.height / 2;
  const sideText =
    side === undefined
      ? null
      : createOutlinedText(scene, 0, y, side, cfg.sideFont, PALETTE.gold).setOrigin(1, 0.5);
  if (sideText) sideText.setX(half);
  const room = cfg.width - (sideText ? sideText.displayWidth + cfg.sideFont : 0);
  const label = fitText(createOutlinedText(scene, -half, y, title, cfg.font), room).setOrigin(
    0,
    0.5,
  );
  const holder = scene.add.container(0, 0, sideText ? [label, sideText] : [label]);
  return holder;
}
