import type * as Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { bodyLookOf } from './edge-squash-look';
import type { BodyFrame } from './edge-squash-marks';

const FRAME: BodyFrame = { pad: 20, padBottom: 10, height: 200 };

/** A fake texture manager that paints a picture by row and counts the reads. */
function fakeTextures(rows: (y: number) => number): {
  tm: Phaser.Textures.TextureManager;
  reads: number[];
} {
  const reads: number[] = [];
  const tm = {
    getPixel: (_x: number, y: number) => {
      reads.push(y);
      return { color: rows(y) };
    },
  } as unknown as Phaser.Textures.TextureManager;
  return { tm, reads };
}

describe('body look of a picture', () => {
  it('reads the fill inside the outline and the outline itself, at the top and at the bottom of the body', () => {
    const o = ANIM.layer.outline;
    const { tm } = fakeTextures((y) => y);
    const look = bodyLookOf(tm, 'look_a', 100, FRAME);
    expect(look.topLine).toBe(Math.round(FRAME.pad + o / 2));
    expect(look.topFill).toBeGreaterThan(FRAME.pad + o);
    expect(look.bottomLine).toBe(Math.round(FRAME.height - FRAME.padBottom - o / 2));
    expect(look.bottomFill).toBeLessThan(FRAME.height - FRAME.padBottom - o);
  });

  it('reads a texture only once', () => {
    const { tm, reads } = fakeTextures(() => 0xabcdef);
    const first = bodyLookOf(tm, 'look_b', 100, FRAME);
    const count = reads.length;
    expect(bodyLookOf(tm, 'look_b', 100, FRAME)).toBe(first);
    expect(reads).toHaveLength(count);
  });
});
