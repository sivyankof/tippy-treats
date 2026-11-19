import { describe, expect, it } from 'vitest';
import { CUT_LOOK } from '../../../data/cuts/cut-look';
import { cutPieceAlpha, cutSpinDegPerSec, sagAmount } from './cut-timeline';

describe('cutSpinDegPerSec', () => {
  it('is fast when narrow and slow when big, in between linearly', () => {
    const { spin } = CUT_LOOK;
    expect(cutSpinDegPerSec(10)).toBe(spin.narrowDegPerSec);
    expect(cutSpinDegPerSec(900)).toBe(spin.wideDegPerSec);
    const mid = cutSpinDegPerSec((spin.narrowPx + spin.widePx) / 2);
    expect(mid).toBeCloseTo((spin.narrowDegPerSec + spin.wideDegPerSec) / 2);
  });
});

describe('cutPieceAlpha', () => {
  it('stays solid until the last quarter, then fades to nothing', () => {
    const from = CUT_LOOK.fadeFrom;
    expect(cutPieceAlpha(0, from)).toBe(1);
    expect(cutPieceAlpha(from, from)).toBe(1);
    expect(cutPieceAlpha(0.9, from)).toBeLessThan(1);
    expect(cutPieceAlpha(0.9, from)).toBeGreaterThan(0);
    expect(cutPieceAlpha(1, from)).toBe(0);
  });
});

describe('sagAmount', () => {
  it('sags during the anticipation and lets go afterwards', () => {
    expect(sagAmount(0)).toBe(0);
    expect(sagAmount(CUT_LOOK.anticipationMs)).toBe(1);
    expect(sagAmount(CUT_LOOK.anticipationMs + CUT_LOOK.sagRecoverMs)).toBe(0);
  });
});
