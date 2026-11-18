import { describe, expect, it, vi } from 'vitest';

const ticks: Array<{ kind: string; urgent?: boolean }> = [];

vi.mock('./style/ring-timer', () => ({
  RingTimer: class {
    setShare(): void {}
    setDigit(): void {}
  },
}));
vi.mock('../../services', () => ({ services: {} }));
vi.mock('../fx/run-cues', () => ({
  playCues: (cues: { sounds: Array<{ kind: string; urgent?: boolean }> }) => {
    ticks.push(...cues.sounds);
  },
}));

import type Phaser from 'phaser';
import type { ContinueFlow } from '../continue-flow';
import { ContinueTimer } from './continue-timer';

function flowLeft(ms: number): ContinueFlow {
  return { remainingMs: ms } as unknown as ContinueFlow;
}

describe('ContinueTimer ticks', () => {
  it('ticks on every second after the first, higher on the last two', () => {
    ticks.length = 0;
    const timer = new ContinueTimer({} as Phaser.Scene, 0);
    // 5 s offer: the first digit (5) is drawn silently, then 4, 3, 2, 1 tick.
    for (const ms of [4900, 4500, 3900, 2900, 1900, 900]) timer.update(flowLeft(ms));
    expect(ticks).toEqual([
      { kind: 'countdownTick', urgent: false },
      { kind: 'countdownTick', urgent: false },
      { kind: 'countdownTick', urgent: true },
      { kind: 'countdownTick', urgent: true },
    ]);
  });

  it('makes no sound inside one second or right after a reset', () => {
    ticks.length = 0;
    const timer = new ContinueTimer({} as Phaser.Scene, 0);
    timer.update(flowLeft(4990));
    timer.update(flowLeft(4800));
    timer.update(flowLeft(4100));
    expect(ticks).toEqual([]);
    timer.reset();
    timer.update(flowLeft(1500));
    expect(ticks).toEqual([]);
  });
});
