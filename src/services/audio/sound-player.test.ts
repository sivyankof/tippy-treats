import { describe, expect, it } from 'vitest';
import { SOUND_TRIM_DB } from '../../data/audio/sound-trim';
import { fromDb } from './levels';
import { SoundPlayer, type DevSoundTrims } from './sound-player';
import type { Synth } from './synth';

/** A synth that only records the trim factor each sound is scheduled with. */
function recordingSynth(): { synth: Synth; factors: number[] } {
  const factors: number[] = [];
  const synth = {
    now: 0,
    measure: (fn: () => void) => {
      fn();
      return 1;
    },
    at: (_delay: number, fn: () => void) => fn(),
    scaled: (factor: number) => {
      factors.push(factor);
    },
  } as unknown as Synth;
  return { synth, factors };
}

describe('SoundPlayer dev trims', () => {
  const base = fromDb(SOUND_TRIM_DB.drop ?? 0);

  it('keeps the plain trim when no correction is set', () => {
    const { synth, factors } = recordingSynth();
    new SoundPlayer(synth).play('drop', []);
    new SoundPlayer(synth, undefined, {}).play('drop', []);
    expect(factors).toEqual([base, base]);
  });

  it('multiplies the trim by the correction, read at every play', () => {
    const { synth, factors } = recordingSynth();
    const dev: DevSoundTrims = {};
    const player = new SoundPlayer(synth, undefined, dev);
    dev.drop = 6;
    player.play('drop', []);
    expect(factors[0]! / base).toBeCloseTo(1.995, 2);
  });
});
