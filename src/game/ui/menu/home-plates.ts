import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t } from '../../../i18n';
import { gameState } from '../../../state';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { XpBar } from './xp-bar';

const { levelPlate, record } = MENU.home;

/** Baker level and XP on a cream plate; the container is placed at the plate centre. */
export function createLevelPlate(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const plate = new VolumePlate(scene, 'window', levelPlate.height).setBodyWidth(levelPlate.width);
  const bar = new XpBar(scene, levelPlate.barX, levelPlate.barY, levelPlate.barWidth).show(
    gameState.data.bakerLevel,
    gameState.data.bakerXp,
  );
  return scene.add.container(0, 0, [plate, bar]);
}

/** The best height ("Record: 42") or the first-tower call, in gold on a purple plate. */
export function createRecordPlate(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const best = gameState.recordHeight;
  const text = best === null ? t('home.noRecord') : t('home.record', { n: formatNumber(best) });
  const label = createOutlinedText(scene, 0, 0, text, record.font, PALETTE.gold);
  const plate = new VolumePlate(scene, 'chip', record.height, { fill: record.fill });
  plate.setBodyWidth(label.width + record.padX * 2);
  label.setY(faceOffsetY('chip'));
  return scene.add.container(0, 0, [plate, label]);
}
