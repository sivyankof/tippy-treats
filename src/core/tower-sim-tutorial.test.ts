import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { layerSpeed } from './drop';
import { config, dropAt, only, pick, untilFlying } from './sim-test-utils';
import { TowerSim, type LandQuality } from './tower-sim';

const { slowLayers, slowSpeedMult, assistAfterLayers, assistTolerance } = BALANCE.tutorial;
/** Between the normal tolerance and the assist tolerance: perfect only with the assist. */
const MID_OFFSET = (BALANCE.drop.perfectTolerance + assistTolerance) / 2;

/** Speed of each of the first `count` spawned layers, every one dropped on target. */
function spawnSpeeds(tutorial: boolean, count: number): number[] {
  const sim = new TowerSim(config({ tutorial }));
  const speeds: number[] = [];
  for (let i = 0; i < count; i++) {
    const spawn = only(untilFlying(sim), 'spawn');
    speeds.push(spawn.layer.speed);
    dropAt(sim, 0);
  }
  return speeds;
}

/** Qualities of `count` drops, each made `offset` px past the target. */
function qualities(sim: TowerSim, count: number, offset: number): Array<LandQuality | 'none'> {
  const result: Array<LandQuality | 'none'> = [];
  for (let i = 0; i < count; i++) {
    result.push(pick(dropAt(sim, offset), 'land')[0]?.quality ?? 'none');
  }
  return result;
}

describe('TowerSim: tutorial run', () => {
  it('slows the first layers and only those', () => {
    const speeds = spawnSpeeds(true, slowLayers + 2);
    speeds.forEach((speed, i) => {
      const normal = layerSpeed(i, 1);
      expect(speed).toBeCloseTo(i < slowLayers ? normal * slowSpeedMult : normal, 5);
    });
  });

  it('leaves speeds alone without the tutorial', () => {
    const speeds = spawnSpeeds(false, slowLayers + 1);
    speeds.forEach((speed, i) => expect(speed).toBeCloseTo(layerSpeed(i, 1), 5));
  });

  it('widens the perfect tolerance after the threshold until the first perfect, then stops', () => {
    const sim = new TowerSim(config({ tutorial: true }));
    const result = qualities(sim, assistAfterLayers + 2, MID_OFFSET);
    expect(result.slice(0, assistAfterLayers).every((q) => q === 'normal')).toBe(true);
    expect(result[assistAfterLayers]).toBe('perfect');
    expect(result[assistAfterLayers + 1]).toBe('normal');
  });

  it('does not assist without the tutorial', () => {
    const sim = new TowerSim(config({ tutorial: false }));
    const result = qualities(sim, assistAfterLayers + 2, MID_OFFSET);
    expect(result.every((q) => q === 'normal')).toBe(true);
  });

  it('does not assist after an earlier perfect drop', () => {
    const sim = new TowerSim(config({ tutorial: true }));
    expect(qualities(sim, 1, 0)).toEqual(['perfect']);
    const result = qualities(sim, assistAfterLayers + 1, MID_OFFSET);
    expect(result.every((q) => q === 'normal')).toBe(true);
  });
});
