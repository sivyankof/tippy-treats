import { describe, expect, it } from 'vitest';
import { CUT_LOOK } from '../../data/cut-look';
import { chooseCutVariant, cutPlanFor, forcedCutVariant, type CutChoice } from './cut-variant';

const base: CutChoice = {
  seed: 123,
  layerNumber: 10,
  share: 0.2,
  pieceWidth: 200,
  lastBigLayer: null,
};

describe('chooseCutVariant', () => {
  it('gives a thin sliver crumbs only', () => {
    const v = chooseCutVariant({ ...base, share: CUT_LOOK.thinShare - 0.01 });
    expect(v).toEqual({ piece: false, strands: false, panic: false, big: false });
  });

  it('gives a big piece strands and panic', () => {
    const v = chooseCutVariant({ ...base, share: 0.4, pieceWidth: 280 });
    expect(v).toEqual({ piece: true, strands: true, panic: true, big: true });
  });

  it('keeps a big piece without a face when it is too narrow for one', () => {
    const v = chooseCutVariant({ ...base, share: 0.4, pieceWidth: 60 });
    expect(v.big && v.strands && !v.panic).toBe(true);
  });

  it('allows a big piece at most once per ten layers', () => {
    const near = chooseCutVariant({ ...base, share: 0.4, lastBigLayer: 5 });
    expect(near.big).toBe(false);
    const gap = CUT_LOOK.bigEveryLayers;
    const far = chooseCutVariant({ ...base, share: 0.4, lastBigLayer: base.layerNumber - gap });
    expect(far.big).toBe(true);
  });

  it('is the same for the same seed and layer, whatever was asked before', () => {
    const first = chooseCutVariant(base);
    chooseCutVariant({ ...base, layerNumber: 3 });
    expect(chooseCutVariant(base)).toEqual(first);
  });

  it('never panics on a piece without room for a face', () => {
    for (let layer = 1; layer < 400; layer++) {
      const v = chooseCutVariant({ ...base, layerNumber: layer, pieceWidth: 50 });
      expect(v.panic).toBe(false);
    }
  });

  it('gives strands about every 4th cut and panic about every 7th, independently', () => {
    let strands = 0;
    let panic = 0;
    let both = 0;
    const n = 6000;
    for (let layer = 1; layer <= n; layer++) {
      const v = chooseCutVariant({ ...base, layerNumber: layer });
      if (v.strands) strands++;
      if (v.panic) panic++;
      if (v.strands && v.panic) both++;
    }
    expect(Math.abs(strands / n - CUT_LOOK.strandChance)).toBeLessThan(0.03);
    expect(Math.abs(panic / n - CUT_LOOK.panicChance)).toBeLessThan(0.03);
    expect(Math.abs(both / n - CUT_LOOK.strandChance * CUT_LOOK.panicChance)).toBeLessThan(0.02);
  });
});

describe('forcedCutVariant', () => {
  it('maps every name to its flags', () => {
    expect(forcedCutVariant('plain')).toMatchObject({ piece: true, strands: false, panic: false });
    expect(forcedCutVariant('strands')).toMatchObject({ strands: true, panic: false });
    expect(forcedCutVariant('panic')).toMatchObject({ strands: false, panic: true });
    expect(forcedCutVariant('big')).toMatchObject({ strands: true, panic: true, big: true });
  });
});

describe('cutPlanFor', () => {
  const all = { piece: true, strands: true, panic: true, big: true };
  it('plays everything on full', () => {
    expect(cutPlanFor('full', all)).toMatchObject({ strands: true, panic: true, trace: true });
    expect(cutPlanFor('full', all)?.crumbs).toEqual(CUT_LOOK.crumbs.full);
  });
  it('keeps the piece and three crumbs on lite', () => {
    expect(cutPlanFor('lite', all)).toEqual({
      crumbs: [3, 3],
      strands: false,
      panic: false,
      trace: false,
    });
  });
  it('is the old fall on minimal', () => {
    expect(cutPlanFor('minimal', all)).toBeNull();
  });
});
