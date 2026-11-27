import * as Phaser from 'phaser';
import type { ClimbBand } from '../../../../core/progression/climb-map';
import { CLIMB_LANDSCAPE } from '../../../../data/progression/climb-landscape';
import { CLIMB_MAP } from '../../../../data/progression/climb-map';
import { formatNumber, t } from '../../../../i18n';
import { signKindOf } from '../../../fx/climb-map/landscape-signs';
import {
  LAND_H,
  landscapeKind,
  signCentreOffset,
  signRect,
} from '../../../fx/climb-map/landscape-math';
import { CLIMB_STAR_KEY } from '../../../fx/zones/climb-map-textures';
import { createOutlinedText } from '../../common/outlined-text';
import { onFontRefresh } from '../widgets/fit-text';
import { bandName } from './climb-map-text';
import { roomScale, type Span } from './climb-map-layout';

const cfg = CLIMB_MAP;
const sign = CLIMB_LANDSCAPE.sign;

/**
 * Shrinks a one-line text to fit `room`, with no lower bound (the shared `fitText` stops at 0.8 and
 * lets a long English name run into the tower); it fits again after a late font load.
 */
export function fitInRoom<T extends Phaser.GameObjects.Text>(text: T, room: number): T {
  onFontRefresh(text, () => fitInRoom(text, room));
  text.setScale(roomScale(text.setScale(1).width, room));
  return text;
}

/** The texts on the sign of a band (name and layers, or "? ? ?"), and the best lap label under it. */
export interface BandLabel {
  holder: Phaser.GameObjects.Container;
  /** Strip span the texts occupy: they fade out near the edges of the view. */
  span: Span;
}

/**
 * Puts the texts on the sign that is baked into the picture of `band`, which stands at strip y
 * `top`. `stripWidth` is the width of the strip (x = 0 is its middle).
 */
export function createBandLabel(
  scene: Phaser.Scene,
  band: ClimbBand,
  top: number,
  stripWidth: number,
  bestLap: number,
): BandLabel {
  const { text } = cfg;
  const kind = landscapeKind(band);
  const shut = !band.open;
  const rect = signRect(kind, shut);
  const left = -stripWidth / 2 + rect.x;
  const centreY = LAND_H / 2 + signCentreOffset(kind, shut);
  const holder = scene.add.container(0, top);
  const add = (item: Phaser.GameObjects.Text, room: number): void => {
    holder.add(fitInRoom(item, room));
  };
  if (shut) {
    const x = left + sign.lockRoom + (rect.width - sign.lockRoom) / 2 + sign.lockTextDx;
    const room = rect.width - sign.lockRoom - sign.lockTextPad;
    add(
      createOutlinedText(
        scene,
        x,
        centreY,
        t('climbMap.locked'),
        text.lockedFont,
        text.lockedColor,
      ),
      room,
    );
  } else {
    const x = left + rect.width / 2;
    const room = rect.width - sign.textPad[signKindOf(kind)] * 2;
    // A name too wide for the sign shrinks to fit it on one line.
    const name = createOutlinedText(
      scene,
      x,
      centreY + (sign.rows[0] ?? 0),
      bandName(band),
      text.nameFont,
    );
    add(name, room);
    add(
      createOutlinedText(
        scene,
        x,
        centreY + (sign.rows[1] ?? 0),
        t('climbMap.range', { from: formatNumber(band.from), to: formatNumber(band.to) }),
        text.rangeFont,
      ),
      room,
    );
  }
  let bottom = centreY + sign.height / 2;
  if (bestLap > 0) {
    const y = bottom + sign.bestLapGap;
    const bl = text.bestLap;
    const starLeft = left + sign.bestLapInset;
    const star = scene.add
      .image(starLeft + bl.star / 2, y, CLIMB_STAR_KEY)
      .setDisplaySize(bl.star, bl.star);
    const label = createOutlinedText(
      scene,
      starLeft + bl.star + bl.gap,
      y,
      t('climbMap.bestLap'),
      bl.font,
    ).setOrigin(0, 0.5);
    const labelRoom =
      cfg.tower.x - cfg.tower.width / 2 - cfg.text.towerGap - (starLeft + bl.star + bl.gap);
    holder.add([star, fitInRoom(label, labelRoom)]);
    bottom = y + bl.star / 2;
  }
  const spanTop = top + centreY - sign.height / 2;
  return { holder, span: { top: spanTop, bottom: top + bottom } };
}
