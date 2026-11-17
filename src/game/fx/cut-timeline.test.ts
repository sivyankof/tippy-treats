import { describe, expect, it } from 'vitest';
import { CUT_LOOK } from '../../data/cut-look';
import {
  cutPieceAlpha,
  cutSpinDegPerSec,
  middleShare,
  recoilAlpha,
  recoilLength,
  sagAmount,
  snapTimeMs,
  stagePair,
  strandClock,
  type StagePair,
  type StrandClock,
} from './cut-timeline';

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

describe('strandClock', () => {
  const clock: StrandClock = { phase: 'bridge', stretch: 0, recoil: 0 };
  it('runs bridge, stretch, recoil and gone in order', () => {
    const { bridgeMs, recoilMs } = CUT_LOOK.strands;
    const snap = snapTimeMs(0);
    expect(strandClock(0, 0, clock).phase).toBe('bridge');
    expect(strandClock(bridgeMs, 0, clock).phase).toBe('stretch');
    expect(strandClock(snap - 1, 0, clock).phase).toBe('stretch');
    expect(strandClock(snap, 0, clock).phase).toBe('recoil');
    expect(strandClock(snap + recoilMs, 0, clock).phase).toBe('gone');
  });
  it('snaps near 330 ms and a shifted strand at its own time', () => {
    expect(snapTimeMs(0)).toBe(CUT_LOOK.strands.snapMs);
    expect(snapTimeMs(-25)).toBe(CUT_LOOK.strands.snapMs - 25);
  });
  it('reports the thinning and the recoil progress', () => {
    expect(strandClock(snapTimeMs(0) / 2, 0, clock).stretch).toBeCloseTo(0.5);
    const half = snapTimeMs(0) + CUT_LOOK.strands.recoilMs / 2;
    expect(strandClock(half, 0, clock).recoil).toBeCloseTo(0.5);
  });
});

describe('strand thinning', () => {
  const pair: StagePair = { low: 0, high: 1, weight: 0 };
  it('goes from a bridge to a thin thread', () => {
    expect(middleShare(0)).toBe(1);
    expect(middleShare(1)).toBeCloseTo(0.26);
    expect(middleShare(0.5)).toBeLessThan(middleShare(0.25));
  });
  it('blends two neighbouring stages', () => {
    expect(stagePair(1, pair)).toMatchObject({ low: 0, weight: 0 });
    stagePair(0.59, pair);
    expect(pair.low).toBe(1);
    expect(pair.high).toBe(2);
    expect(pair.weight).toBeGreaterThan(0);
    expect(pair.weight).toBeLessThan(1);
    stagePair(0.26, pair);
    expect(pair.high).toBe(3);
    expect(pair.weight).toBe(1);
  });
});

describe('recoil', () => {
  it('springs back past its rest and settles on it, then fades', () => {
    const { restShare } = CUT_LOOK.strands.recoil;
    expect(recoilLength(0)).toBeCloseTo(1);
    expect(recoilLength(1)).toBeCloseTo(restShare);
    let min = 1;
    for (let u = 0; u <= 1; u += 0.02) min = Math.min(min, recoilLength(u));
    expect(min).toBeLessThan(restShare);
    expect(min).toBeGreaterThan(0);
    expect(recoilAlpha(0)).toBe(1);
    expect(recoilAlpha(1)).toBe(0);
  });
});
