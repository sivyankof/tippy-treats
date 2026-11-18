import { describe, expect, it } from 'vitest';
import { NodeTally } from '../node-tally';
import { MusicVoices } from './music-voices';

class FakeNode {
  onended: ((event: Event) => void) | null = null;
  readonly gain = new FakeParam();
  readonly frequency = new FakeParam();
  readonly detune = new FakeParam();
  connect(): void {}
  disconnect(): void {}
  setPeriodicWave(): void {}
  start(): void {}
  stop(): void {}
}

class FakeParam {
  setValueAtTime(): void {}
  linearRampToValueAtTime(): void {}
  setTargetAtTime(): void {}
}

function setup() {
  const oscillators: FakeNode[] = [];
  const ctx = {
    createGain: () => new FakeNode(),
    createOscillator: () => {
      const osc = new FakeNode();
      oscillators.push(osc);
      return osc;
    },
    createPeriodicWave: () => ({}),
  } as unknown as BaseAudioContext;
  return { ctx, oscillators };
}

describe('MusicVoices', () => {
  it('lets a keys voice go even when disconnecting its wobble throws', () => {
    const { ctx, oscillators } = setup();
    const wobble = {
      connect() {},
      disconnect() {
        throw new Error('InvalidAccessError');
      },
    } as unknown as AudioNode;
    const voices = new MusicVoices(ctx, new NodeTally(), () => 0.5, wobble);
    let ended = 0;
    voices.play('ep', { time: 0, length: 1, pitch: 0, gain: 1 }, new FakeNode() as never, () => {
      ended++;
    });
    const [first] = oscillators;
    expect(first?.onended).toBeTypeOf('function');
    expect(() => first?.onended?.(new Event('ended'))).not.toThrow();
    expect(ended).toBe(1);
  });
});
