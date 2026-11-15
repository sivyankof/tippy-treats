import { describe, expect, it } from 'vitest';
import { TOWER_SPARKLES } from '../../data/tower-sparkles';
import { sparkleSpot, type SparkleField } from './tower-sparkle-spot';

const field: SparkleField = {
  left: 180,
  right: 900,
  topY: -1000,
  layerHeight: 120,
  screenWidth: 1080,
  avoid: null,
};

describe('sparkleSpot', () => {
  it('stands outside the top layer, on the chosen side', () => {
    const left = sparkleSpot(field, [0.1, 0.5, 0.5]);
    const right = sparkleSpot(field, [0.9, 0.5, 0.5]);
    expect(left?.x).toBeLessThan(field.left);
    expect(right?.x).toBeGreaterThan(field.right);
  });

  it('stays clear of the widest layer in reach: left and right are that extent', () => {
    // A lower layer reaching 40 px further out on each side than the top one: the field is that wider extent.
    const wide = { ...field, left: field.left - 40, right: field.right + 40 };
    const left = sparkleSpot(wide, [0.1, 0, 0.999]);
    const right = sparkleSpot(wide, [0.9, 0, 0.999]);
    expect(left?.x).toBeLessThanOrEqual(wide.left - TOWER_SPARKLES.gapPx[0]);
    expect(right?.x).toBeGreaterThanOrEqual(wide.right + TOWER_SPARKLES.gapPx[0]);
  });

  it('stays near the top of the tower', () => {
    const high = sparkleSpot(field, [0.9, 0.2, 0]);
    const low = sparkleSpot(field, [0.9, 0.2, 0.999]);
    expect(high?.y).toBeGreaterThanOrEqual(field.topY - TOWER_SPARKLES.rowsAbove * 120 - 1);
    expect(low?.y).toBeLessThanOrEqual(field.topY + TOWER_SPARKLES.rowsBelow * 120);
  });

  it('skips the column of the flying layer above the tower', () => {
    const avoid = { left: 800, right: 1000 };
    expect(sparkleSpot({ ...field, avoid }, [0.9, 0.2, 0])).toBeNull();
    // Further down the tower the column no longer matters.
    expect(sparkleSpot({ ...field, avoid }, [0.9, 0.2, 0.999])).not.toBeNull();
    // The other side is free.
    expect(sparkleSpot({ ...field, avoid }, [0.1, 0.5, 0])).not.toBeNull();
  });

  it('skips spots off the screen', () => {
    expect(sparkleSpot({ ...field, left: 40 }, [0.1, 0.9, 0.5])).toBeNull();
  });
});
