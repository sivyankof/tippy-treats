import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/tower/balance';
import { TempoEase } from './tempo-ease';

const { afterPerfects, layers, speedMult, minGapLayers } = BALANCE.tempoEase;

describe('TempoEase', () => {
  it('stays at full speed below the streak', () => {
    const ease = new TempoEase();
    for (let i = 1; i <= 20; i++) expect(ease.next(i, afterPerfects - 1).mult).toBe(1);
  });

  it('eases `layers` layers after the streak, counting down', () => {
    const ease = new TempoEase();
    const first = ease.next(8, afterPerfects);
    expect(first).toEqual({ mult: speedMult, started: true, left: layers });
    // The streak is broken, the ease still runs its length.
    for (let k = 1; k < layers; k++) {
      expect(ease.next(8 + k, 0)).toEqual({ mult: speedMult, started: false, left: layers - k });
    }
    expect(ease.next(8 + layers, afterPerfects).mult).toBe(1);
  });

  it('waits `minGapLayers` from start to start before the next ease', () => {
    const ease = new TempoEase();
    ease.next(6, afterPerfects);
    for (let i = 7; i < 6 + minGapLayers; i++) {
      expect(ease.next(i, afterPerfects + 3).started).toBe(false);
    }
    expect(ease.next(6 + minGapLayers, afterPerfects).started).toBe(true);
  });

  it('gives a retry of the same layer the first decision and spends nothing', () => {
    const ease = new TempoEase();
    const first = ease.next(6, afterPerfects);
    const retry = ease.next(6, 0);
    expect(retry).toEqual({ ...first, started: false });
    expect(ease.next(7, 0).left).toBe(layers - 1);
    // A plain layer stays plain when it comes back, whatever the combo says now.
    const plain = new TempoEase();
    plain.next(2, 0);
    expect(plain.next(2, afterPerfects).mult).toBe(1);
  });

  it('is deterministic for the same input', () => {
    const run = (): number[] => {
      const ease = new TempoEase();
      return Array.from({ length: 60 }, (_, i) => ease.next(i + 1, (i * 7) % 9).mult);
    };
    expect(run()).toEqual(run());
  });
});
