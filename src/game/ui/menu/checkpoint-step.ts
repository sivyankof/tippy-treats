import type * as Phaser from 'phaser';
import type { CheckpointRow } from '../../../core/checkpoints';
import { CHECKPOINT_WINDOW } from '../../../data/zones/checkpoint-look';
import { PALETTE } from '../../../data/common/palette';
import { ZONES, type ZoneId } from '../../../data/zones/zones';
import { t } from '../../../i18n';
import { checkpointZoneTexture } from '../../fx/checkpoint-textures';
import { VIDEO_ICON_FIELD_SCALE, VIDEO_ICON_KEY, bakeVideoIcon } from '../../fx/video-icon-texture';
import { attachPressFeedback } from '../button';
import { createOutlinedText } from '../outlined-text';
import { createPlate, faceOffsetY } from '../style/volume';
import { fitText } from './fit-text';
import { drawPadlock } from './padlock';
import { PriceTag } from './price-tag';

const cfg = CHECKPOINT_WINDOW;

export interface CheckpointStepOptions {
  row: CheckpointRow;
  selected: boolean;
  /** Taps are taken (off while a start is being paid). */
  tappable: boolean;
  /** Centre of the step in the parent and its width. */
  x: number;
  y: number;
  width: number;
  onSelect: () => void;
}

/**
 * One step of the climb: the zone picture, the zone name over "Layer N" and the price on the right
 * (a lock and "reach layer N from scratch" until a run from zero reaches it). An open step selects on a tap.
 */
export function createCheckpointStep(
  scene: Phaser.Scene,
  options: CheckpointStepOptions,
): Phaser.GameObjects.Container {
  const { row, width } = options;
  const height = cfg.stepHeight;
  const zone: ZoneId = ZONES[row.zoneIndex]?.id ?? 'kitchen';
  const fill = row.locked
    ? cfg.fills.locked
    : options.selected
      ? cfg.fills.selected
      : cfg.fills.open;
  const plate = createPlate(scene, 'card', 0, 0, width, height, {
    fill,
    rim: options.selected ? cfg.selectedRim : undefined,
  });
  const faceY = faceOffsetY('card');
  const left = -width / 2 + cfg.stepPad;
  const picture = scene.add
    .image(left + cfg.pictureSize / 2, faceY, checkpointZoneTexture(zone))
    .setDisplaySize(cfg.pictureSize, cfg.pictureSize);
  if (row.locked) picture.setTint(PALETTE.panelShadow).setAlpha(cfg.lockedPictureAlpha);

  const textLeft = left + cfg.pictureSize + cfg.textGap;
  const textWidth = width - cfg.stepPad * 2 - cfg.pictureSize - cfg.textGap - cfg.priceWidth;
  const line = (y: number, text: string, font: number, color?: number) =>
    fitText(createOutlinedText(scene, textLeft, y, text, font, color).setOrigin(0, 0.5), textWidth);
  const name = line(faceY - cfg.lineOffset, t(`zone.${zone}.name`), cfg.nameFont);
  const sub = line(
    faceY + cfg.lineOffset,
    row.locked
      ? t('checkpoint.window.locked', { n: row.height })
      : t('checkpoint.window.layer', { n: row.height }),
    cfg.layerFont,
    PALETTE.panel,
  );

  const priceX = width / 2 - cfg.stepPad - cfg.priceWidth / 2;
  const parts: Phaser.GameObjects.GameObject[] = [plate, picture, name, sub];
  if (row.locked) {
    const g = scene.add.graphics();
    drawPadlock(g, priceX, faceY, cfg.lockSize);
    parts.push(g);
  } else if (row.height === 0) {
    parts.push(
      fitText(
        createOutlinedText(scene, priceX, faceY, t('checkpoint.window.free'), cfg.freeFont),
        cfg.priceWidth,
      ),
    );
  } else {
    const hasAd = row.ad === 'ready' || row.ad === 'unavailable';
    const shiftUp = hasAd ? cfg.adMark.offsetY / 2 : 0;
    const tag = new PriceTag(scene, priceX, faceY - shiftUp, cfg.priceFont);
    tag.show('{price}', row.berries, 'berries');
    tag.setScale(Math.min(1, cfg.priceWidth / tag.contentWidth));
    parts.push(tag);
    if (hasAd) {
      // The shared video icon of every rewarded-video button, small, under the price.
      bakeVideoIcon(scene);
      const side = cfg.adMark.size * VIDEO_ICON_FIELD_SCALE;
      const mark = scene.add
        .image(priceX, faceY - shiftUp + cfg.adMark.offsetY, VIDEO_ICON_KEY)
        .setDisplaySize(side, side);
      if (row.ad === 'unavailable') mark.setAlpha(cfg.adMark.dimAlpha);
      parts.push(mark);
    }
  }

  const step = scene.add.container(options.x, options.y, parts).setSize(width, height);
  if (!row.locked && options.tappable) {
    step.setInteractive();
    attachPressFeedback(step, { onTap: options.onSelect });
  }
  return step;
}
