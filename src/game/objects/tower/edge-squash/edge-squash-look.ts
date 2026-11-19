import type * as Phaser from 'phaser';
import { ANIM } from '../../../../data/common/anim';
import { picturePixel } from '../../../ui/bake-texture';
import type { BodyFrame } from './edge-squash-marks';

/** The colours the rounded silhouette of the crumpled part is drawn in: what the body of the picture has at its top and bottom edge. */
export interface BodyLook {
  topFill: number;
  topLine: number;
  bottomFill: number;
  bottomLine: number;
}

/** Where in the picture the colours are read: this far inside the outline (px), and in the middle of the width. */
const FILL_INSET_PX = 4;
const MIDDLE = 0.5;

const cache = new Map<string, BodyLook>();

/**
 * The colours of the body of the picture `key` (`width` wide, body placed by `frame`): the fill just
 * inside the outline and the outline itself, at the top and at the bottom edge. They are read from
 * the baked picture (once per texture), so the silhouette matches whatever the layer is made of: the
 * glaze and sponge of a plain layer, the jelly, the icing of a puff.
 */
export function bodyLookOf(
  textures: Phaser.Textures.TextureManager,
  key: string,
  width: number,
  frame: Readonly<BodyFrame>,
): Readonly<BodyLook> {
  let look = cache.get(key);
  if (look) return look;
  const outline = ANIM.layer.outline;
  const x = Math.floor(width * MIDDLE);
  const bottom = frame.height - frame.padBottom;
  const at = (y: number): number => picturePixel(textures, x, Math.round(y), key);
  look = {
    topFill: at(frame.pad + outline + FILL_INSET_PX),
    topLine: at(frame.pad + outline / 2),
    bottomFill: at(bottom - outline - FILL_INSET_PX),
    bottomLine: at(bottom - outline / 2),
  };
  cache.set(key, look);
  return look;
}
