import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../save/defaults';
import { JOURNAL, JOURNAL_ROW_IDS } from '../../data/progression/journal';
import { journalCounts, journalTiers, tierPlace } from './journal';

const TIERS = [{ from: 0 }, { from: 50 }, { from: 500 }, { from: 1000 }];

describe('tierPlace', () => {
  it('is the first tier below the first real threshold', () => {
    expect(tierPlace(0, TIERS)).toEqual({ index: 0, from: 0, next: 50, share: 0 });
    expect(tierPlace(25, TIERS)).toEqual({ index: 0, from: 0, next: 50, share: 0.5 });
  });

  it('starts a tier exactly at its threshold', () => {
    expect(tierPlace(49, TIERS).index).toBe(0);
    expect(tierPlace(50, TIERS)).toEqual({ index: 1, from: 50, next: 500, share: 0 });
    expect(tierPlace(275, TIERS).share).toBe(0.5);
  });

  it('fills the bar on the top tier, however far above it', () => {
    expect(tierPlace(1000, TIERS)).toEqual({ index: 3, from: 1000, next: null, share: 1 });
    expect(tierPlace(1e9, TIERS).index).toBe(3);
  });

  it('takes fractional thresholds (litres, metres)', () => {
    const tiers = [{ from: 0 }, { from: 1.7 }, { from: 10 }];
    expect(tierPlace(1.69, tiers).index).toBe(0);
    expect(tierPlace(1.7, tiers).index).toBe(1);
  });
});

describe('journal tiers', () => {
  it.each(['flies', ...JOURNAL_ROW_IDS] as const)('%s starts at 0 and rises', (id) => {
    const tiers = journalTiers(id).map((tier) => tier.from);
    expect(tiers[0]).toBe(0);
    for (let i = 1; i < tiers.length; i++) expect(tiers[i]).toBeGreaterThan(tiers[i - 1] ?? 0);
  });

  it('shares tiers I..III with the achievements where the counter is the same', () => {
    const firstThree = (id: 'flies' | 'perfects' | 'runs' | 'layers') =>
      journalTiers(id)
        .slice(1, 4)
        .map((tier) => tier.from);
    expect(firstThree('flies')).toEqual([50, 500, 1000]);
    expect(firstThree('perfects')).toEqual([100, 1000, 5000]);
    expect(firstThree('runs')).toEqual([10, 100, 500]);
    expect(firstThree('layers')).toEqual([500, 5000, 25000]);
  });

  it('has five dishes for the flies, from the glass to the bathtub', () => {
    expect(JOURNAL.flies).toHaveLength(6);
  });
});

describe('journalCounts', () => {
  it('reads the stats and turns layers into metres and litres', () => {
    const stats = { ...createDefaultSave(0, 'x').stats, totalLayers: 4800, perfects: 1200 };
    expect(journalCounts({ ...stats, runs: 340, flies: 312 })).toEqual({
      flies: 312,
      layers: 4800,
      height: 4800 * JOURNAL.layerHeightM,
      glaze: 4800 * JOURNAL.glazePerLayerL,
      perfects: 1200,
      runs: 340,
    });
  });

  it('never shows float noise', () => {
    const stats = { ...createDefaultSave(0, 'x').stats, totalLayers: 3 };
    expect(journalCounts(stats).height).toBe(0.15);
    expect(journalCounts(stats).glaze).toBe(0.3);
  });
});
