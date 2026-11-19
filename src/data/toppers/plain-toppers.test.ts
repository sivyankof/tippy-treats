import { describe, expect, it } from 'vitest';
import { BERRY_LOOK } from '../economy/berry-look';
import { PLAIN_TOPPERS, STRAWBERRY_PAD_PX, TOPPER_KINDS, topperBakedSize } from './plain-toppers';
import { SHARED_ATLAS } from '../common/shared-atlas';

describe('topperBakedSize', () => {
  it('is the padded berry picture for the strawberry', () => {
    const side = BERRY_LOOK.textureSize + 2 * STRAWBERRY_PAD_PX;
    expect(topperBakedSize('strawberry')).toEqual({ width: side, height: side });
  });

  it('is the drawing with its field at the bake and show scale for the other kinds', () => {
    const s = PLAIN_TOPPERS.bakeScale * PLAIN_TOPPERS.showScale;
    const { width, height, field } = PLAIN_TOPPERS.kinds.cherry;
    expect(topperBakedSize('cherry')).toEqual({
      width: (width + field.left + field.right) * s,
      height: (height + field.top + field.bottom) * s,
    });
  });

  it('gives every kind a picture that fits the shared atlas', () => {
    for (const kind of TOPPER_KINDS) {
      const { width, height } = topperBakedSize(kind);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(Math.max(width, height)).toBeLessThanOrEqual(SHARED_ATLAS.maxSide);
    }
  });
});
