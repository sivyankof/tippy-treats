import * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { PALETTE } from '../../../data/common/palette';
import { formatNumber, t } from '../../../i18n';
import { gameState } from '../../../state';
import { createOutlinedText } from '../common/outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { XpBar } from './xp-bar';

const { levelPlate, record, highlightRing } = MENU.home;

/** Baker level and XP on a cream plate; the container is placed at the plate centre. */
export function createLevelPlate(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const plate = new VolumePlate(scene, 'window', levelPlate.height).setBodyWidth(levelPlate.width);
  const bar = new XpBar(scene, levelPlate.barX, levelPlate.barY, levelPlate.barWidth).show(
    gameState.data.bakerLevel,
    gameState.data.bakerXp,
  );
  return scene.add.container(0, 0, [plate, bar]);
}

/** Shows the level and XP of the save again (a mission paid XP while the screen stood). */
export function refreshLevelPlate(plate: Phaser.GameObjects.Container): void {
  const bar = plate.getAt(1);
  if (bar instanceof XpBar) bar.show(gameState.data.bakerLevel, gameState.data.bakerXp);
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

/** A ring around Play that grows and fades again and again, until Play is pressed. */
export function createPlayRing(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const { width, grow, ms, pad } = highlightRing;
  const { playWidth, playHeight, playRadius } = MENU.home;
  const g = scene.add.graphics();
  const w = playWidth + pad * 2;
  const h = playHeight + pad * 2;
  g.lineStyle(width, PALETTE.gold, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, playRadius + pad);
  const holder = scene.add.container(0, 0, [g]);
  scene.tweens.add({
    targets: g,
    scale: grow,
    alpha: 0,
    duration: ms,
    ease: 'Sine.easeOut',
    repeat: -1,
  });
  return holder;
}
