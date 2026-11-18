import type * as Phaser from 'phaser';
import { TOPPER_KINDS, topperBakedSize } from '../../data/plain-toppers';
import { SPACE_VISITOR } from '../../data/space-visitor';
import { paddedSize } from '../../util/field-pad';
import { tallestFirst } from '../../util/shelf-packer';
import { ensureTopperTexture } from '../fx/topper-texture';
import { bakeSpaceVisitor } from '../objects/backdrop/space-visitor-art';

/**
 * The tall pictures that stay on the shared atlas for good once baked: the toppers of the plain layers and the
 * guests of Space. Baked one by one as a run first needs them, each opened a shelf of its own height low on the page,
 * under the layers baked before it, and the layers then filled it (the page peaked at 0.80 of its height with the
 * crew). Baked together while the game loads, tallest first, they share one or two shelves at the top of the page
 * (docs/08-architecture.md, section 12).
 */
export function bakeTallAtlasArt(scene: Phaser.Scene): void {
  const guests = Object.keys(SPACE_VISITOR.guests) as (keyof typeof SPACE_VISITOR.guests)[];
  const items = [
    ...TOPPER_KINDS.map((kind) => ({
      height: topperBakedSize(kind).height,
      bake: () => ensureTopperTexture(scene, kind),
    })),
    ...guests.map((id) => {
      const spec = SPACE_VISITOR.guests[id];
      return {
        height: paddedSize(spec.width, spec.height, spec.fieldPad)[1],
        bake: () => bakeSpaceVisitor(scene, id),
      };
    }),
  ];
  for (const item of tallestFirst(items)) item.bake();
}
