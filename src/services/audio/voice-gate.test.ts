import { describe, expect, it } from 'vitest';
import { VoiceGate, type VoiceGateConfig } from './voice-gate';

const CONFIG: VoiceGateConfig = {
  dedupeSec: 0.04,
  dedupeById: { thud: 0.045 },
  voiceCap: { normal: 3, ambient: 1 },
};

describe('VoiceGate', () => {
  it('refuses the same id within the dedupe time and admits it after', () => {
    const gate = new VoiceGate(CONFIG);
    expect(gate.admit('coin', 'normal', 0)).toBe(true);
    expect(gate.admit('coin', 'normal', 0.03)).toBe(false);
    expect(gate.admit('coin', 'normal', 0.05)).toBe(true);
    expect(gate.admit('click', 'normal', 0.05)).toBe(true);
  });

  it('uses the own interval of a sound that has one', () => {
    const gate = new VoiceGate(CONFIG);
    expect(gate.admit('thud', 'normal', 0)).toBe(true);
    expect(gate.admit('thud', 'normal', 0.042)).toBe(false);
    expect(gate.admit('thud', 'normal', 0.046)).toBe(true);
  });

  it('refuses normal sounds at the cap and admits them when sounds end', () => {
    const gate = new VoiceGate(CONFIG);
    for (const id of ['a', 'b', 'c']) {
      expect(gate.admit(id, 'normal', 0)).toBe(true);
      gate.hold(0, 1);
    }
    expect(gate.active(0.5)).toBe(3);
    expect(gate.admit('d', 'normal', 0.5)).toBe(false);
    expect(gate.admit('d', 'normal', 1.01)).toBe(true);
  });

  it('refuses ambient sounds at their lower cap', () => {
    const gate = new VoiceGate(CONFIG);
    gate.admit('a', 'normal', 0);
    gate.hold(0, 1);
    expect(gate.admit('wind', 'ambient', 0.1)).toBe(false);
    expect(gate.admit('b', 'normal', 0.1)).toBe(true);
  });

  it('never refuses a critical sound for the cap, but still dedupes it', () => {
    const gate = new VoiceGate(CONFIG);
    for (const id of ['a', 'b', 'c', 'd']) {
      gate.admit(id, 'critical', 0);
      gate.hold(0, 1);
    }
    expect(gate.admit('drop', 'critical', 0.5)).toBe(true);
    expect(gate.admit('drop', 'critical', 0.51)).toBe(false);
  });

  it('does not count a zero-length sound', () => {
    const gate = new VoiceGate(CONFIG);
    gate.admit('a', 'normal', 0);
    gate.hold(0, 0);
    expect(gate.active(0)).toBe(0);
  });
});
