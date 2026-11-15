import { afterEach, describe, expect, it } from 'vitest';
import { EDGE_SQUASH } from '../../data/edge-squash';
import { effectsMode } from '../effects-mode';
import type { AbilityBursts } from './abilities/ability-bursts';
import { DROP_BIG_SCALE, FX_TEXTURES } from './fx-textures';
import { wallGlazeDrops } from './material-fx';

interface Cone {
  x: number;
  directionDeg: number;
  count: number;
  speed: number;
  scale: number;
  texture: string;
}

/** Collects the cones a burst call asks for. */
function throwDrops(count: number, size: number, inwards: 1 | -1): Cone[] {
  const cones: Cone[] = [];
  const bursts = {
    cone: (
      x: number,
      _y: number,
      directionDeg: number,
      n: number,
      style: { speed: readonly [number, number]; scale: readonly [number, number] },
      texture: string,
    ) =>
      cones.push({
        x,
        directionDeg,
        count: n,
        speed: style.speed[0],
        scale: style.scale[0],
        texture,
      }),
  } as unknown as AbilityBursts;
  wallGlazeDrops(bursts, count, size, 0xffffff, 12, 500, inwards);
  return cones;
}

afterEach(() => effectsMode.setChoice('auto'));

describe('glaze drops off the wall', () => {
  it('throws one drop per launch, each its own way and speed, so they fly apart', () => {
    const cones = throwDrops(3, 1, 1);
    expect(cones).toHaveLength(3);
    expect(new Set(cones.map((c) => c.directionDeg)).size).toBe(3);
    expect(new Set(cones.map((c) => c.speed)).size).toBe(3);
    for (const c of cones) expect(c.count).toBe(1);
  });

  it('throws them up and away from the wall, mirrored on the other wall', () => {
    for (const inwards of [1, -1] as const) {
      for (const c of throwDrops(3, 1, inwards)) {
        const rad = (c.directionDeg * Math.PI) / 180;
        expect(Math.sin(rad)).toBeLessThan(-0.8);
        expect(Math.cos(rad) * inwards).toBeGreaterThan(-0.4);
      }
    }
    const left = throwDrops(3, 1, 1);
    const right = throwDrops(3, 1, -1);
    left.forEach((c, i) => expect(c.directionDeg + right[i]!.directionDeg).toBeCloseTo(-180, 9));
  });

  it('flies the big padded drop texture, scaled back down, so the smooth edge is never cut', () => {
    for (const cone of throwDrops(3, 1, 1)) expect(cone.texture).toBe(FX_TEXTURES.dropBig);
  });

  it('throws fewer and smaller drops for a weaker touch, none for none or in fewer effects', () => {
    expect(throwDrops(2, 0.5, 1)).toHaveLength(2);
    expect(throwDrops(2, 0.5, 1)[0]!.scale).toBeCloseTo(
      (EDGE_SQUASH.drops.style.scale[0] * 0.5) / DROP_BIG_SCALE,
      9,
    );
    expect(throwDrops(0, 1, 1)).toHaveLength(0);
    effectsMode.setChoice('on');
    expect(throwDrops(3, 1, 1)).toHaveLength(0);
  });
});
