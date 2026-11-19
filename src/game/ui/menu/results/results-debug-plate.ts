import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { t } from '../../../../i18n';
import { createPlate } from '../../style/volume';
import { createOutlinedText } from '../../common/outlined-text';
import { fitText } from '../widgets/fit-text';

const cfg = MENU.results.debugPlate;

/** The dev-only notice over a run that is not saved. */
export function createDebugPlate(scene: Phaser.Scene): {
  obj: Phaser.GameObjects.Container;
  height: number;
} {
  const plate = createPlate(scene, 'card', 0, 0, cfg.width, cfg.height, { fill: PALETTE.danger });
  const label = fitText(
    createOutlinedText(scene, 0, 0, t('results.debugRun'), cfg.font),
    cfg.width - MENU.style.toast.textPadding,
  );
  return { obj: scene.add.container(0, 0, [plate, label]), height: cfg.height };
}
