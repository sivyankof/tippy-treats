import { describe, expect, it } from 'vitest';
import { SFX } from '../../data/sfx';
import {
  clampComboStep,
  collapseThudGain,
  comboGainScale,
  comboNoteFreq,
  jitterRatio,
  noteFreq,
  semitoneRatio,
} from './notes';

const LADDER_LENGTH = SFX.perfect.ladderSemitones.length;

describe('notes', () => {
  it('an octave doubles the frequency', () => {
    expect(semitoneRatio(12)).toBeCloseTo(2);
    expect(noteFreq(440, 12)).toBeCloseTo(880);
  });

  it('the combo ladder strictly rises over all steps', () => {
    for (let step = 2; step <= LADDER_LENGTH; step++) {
      expect(comboNoteFreq(step)).toBeGreaterThan(comboNoteFreq(step - 1));
    }
  });

  it('step 6 is one octave above step 1', () => {
    expect(comboNoteFreq(6) / comboNoteFreq(1)).toBeCloseTo(2);
  });

  it('steps beyond the maximum stay on the last one', () => {
    expect(comboNoteFreq(LADDER_LENGTH + 1)).toBe(comboNoteFreq(LADDER_LENGTH));
    expect(comboNoteFreq(500)).toBe(comboNoteFreq(LADDER_LENGTH));
  });

  it('bad steps fall back to the first one', () => {
    expect(clampComboStep(0)).toBe(1);
    expect(clampComboStep(Number.NaN)).toBe(1);
    expect(comboNoteFreq(-3)).toBe(comboNoteFreq(1));
  });

  it('combo bells get louder up to the cap', () => {
    expect(comboGainScale(1)).toBe(1);
    expect(comboGainScale(6)).toBeGreaterThan(comboGainScale(1));
    expect(comboGainScale(12)).toBeLessThanOrEqual(SFX.perfect.maxGainScale);
  });

  it('jitter stays within the spread', () => {
    const spread = SFX.drop.pitchJitter;
    expect(jitterRatio(spread, () => 0)).toBeCloseTo(1 - spread);
    expect(jitterRatio(spread, () => 1)).toBeCloseTo(1 + spread);
    expect(jitterRatio(spread, () => 0.5)).toBeCloseTo(1);
    for (let i = 0; i < 200; i++) {
      const ratio = jitterRatio(spread);
      expect(ratio).toBeGreaterThanOrEqual(1 - spread);
      expect(ratio).toBeLessThanOrEqual(1 + spread);
    }
  });

  it('collapse slaps get quieter but never below the floor', () => {
    expect(collapseThudGain(0)).toBe(1);
    expect(collapseThudGain(5)).toBeLessThan(collapseThudGain(1));
    expect(collapseThudGain(1000)).toBe(SFX.collapse.gainFloor);
    expect(collapseThudGain(-4)).toBe(1);
  });
});
