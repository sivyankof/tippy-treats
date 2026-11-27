import { describe, expect, it } from 'vitest';
import { createDefaultSave } from './defaults';
import { loadSave } from './load';
import { migrate, migrateV10 } from './migrations';
import { SAVE_VERSION } from './schema';
import { NEVER_SYNCED, withProgressChanged } from './sync';

const NOW = 1_700_000_000_000;
const fresh = () => createDefaultSave(NOW, 'old-install');
const load = (primary: string) => loadSave(primary, null, NOW, () => 'new-install');

/** A version 10 text as 1.0.2 wrote it: none of the fields of version 11. */
function v10(): Record<string, unknown> {
  const save = fresh();
  const stats: Record<string, unknown> = {
    ...save.stats,
    runs: 40,
    totalLayers: 900,
    perfects: 120,
  };
  const records: Record<string, unknown> = { ...save.records, classicHeight: 64 };
  delete stats.flies;
  delete records.dailyBest;
  const raw: Record<string, unknown> = {
    ...save,
    version: 10,
    stats,
    records,
    daily: { ...save.daily, day: '2026-11-26', best: 37 },
    today: { day: '2026-11-26', bestHeight: 41 },
  };
  delete raw.prevDay;
  delete raw.sync;
  return raw;
}

describe('migration 10 -> 11', () => {
  it('starts the flies at zero, the daily best from today, no earlier day and no sync', () => {
    const next = migrateV10(v10());
    expect(next.stats).toMatchObject({ runs: 40, totalLayers: 900, perfects: 120, flies: 0 });
    expect(next.records).toMatchObject({ classicHeight: 64, dailyBest: 37 });
    expect(next.prevDay).toEqual({ day: '', bestHeight: 0 });
    expect(next.sync).toEqual({ cloudRev: 0, cloudId: '', dirty: true });
  });

  it('runs as the last step of the chain and keeps the rest', () => {
    const save = migrate(v10(), NOW);
    expect(save.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(11);
    expect(save.today).toEqual({ day: '2026-11-26', bestHeight: 41 });
    expect(save.records.dailyBest).toBe(37);
  });

  it('leaves damaged stats and records as they are, for the loader to see', () => {
    const raw = { ...v10(), stats: 'x', records: null };
    const next = migrateV10(raw);
    expect(next.stats).toBe('x');
    expect(next.records).toBeNull();
  });

  it('takes a damaged daily best as zero', () => {
    const raw = { ...v10(), daily: { best: 'lots' } };
    expect(migrateV10(raw).records).toMatchObject({ dailyBest: 0 });
  });

  it('loads a version 10 text into a full version 11 save', () => {
    const result = load(JSON.stringify(v10()));
    expect(result.source).toBe('primary');
    expect(result.save.stats.flies).toBe(0);
    expect(result.save.records.dailyBest).toBe(37);
    expect(result.save.prevDay).toEqual({ day: '', bestHeight: 0 });
    expect(result.save.sync).toEqual(NEVER_SYNCED);
  });
});

describe('fields of version 11 in the loader', () => {
  it('keeps valid values across a load', () => {
    const save = {
      ...fresh(),
      stats: { ...fresh().stats, flies: 12 },
      records: { ...fresh().records, dailyBest: 55 },
      prevDay: { day: '2026-11-25', bestHeight: 30 },
      sync: { cloudRev: 4, cloudId: 'c-1', dirty: false },
    };
    const loaded = load(JSON.stringify(save)).save;
    expect(loaded.stats.flies).toBe(12);
    expect(loaded.records.dailyBest).toBe(55);
    expect(loaded.prevDay).toEqual({ day: '2026-11-25', bestHeight: 30 });
    expect(loaded.sync).toEqual({ cloudRev: 4, cloudId: 'c-1', dirty: false });
  });

  it('fills missing fields: flies 0, the daily best from today, an empty day, never synced', () => {
    const save: Record<string, unknown> = {
      ...fresh(),
      daily: { ...fresh().daily, best: 21 },
      stats: { runs: 3, totalLayers: 10, perfects: 1, adsWatched: 0 },
      records: { classicHeight: 5, classicScore: 10, bestCombo: 1 },
    };
    delete save.prevDay;
    delete save.sync;
    const loaded = load(JSON.stringify(save)).save;
    expect(loaded.stats.flies).toBe(0);
    expect(loaded.records.dailyBest).toBe(21);
    expect(loaded.prevDay).toEqual({ day: '', bestHeight: 0 });
    expect(loaded.sync).toEqual(NEVER_SYNCED);
  });

  it('repairs damaged values', () => {
    const save = {
      ...fresh(),
      stats: { ...fresh().stats, flies: -3 },
      records: { ...fresh().records, dailyBest: 'x' },
      prevDay: { day: 'yesterday', bestHeight: 9 },
    };
    const loaded = load(JSON.stringify(save)).save;
    expect(loaded.stats.flies).toBe(0);
    expect(loaded.records.dailyBest).toBe(0);
    expect(loaded.prevDay).toEqual({ day: '', bestHeight: 0 });
  });

  it.each([
    ['a string sync', 'synced'],
    ['a missing id', { cloudRev: 3, dirty: false }],
    ['a negative number', { cloudRev: -1, cloudId: 'a', dirty: false }],
    ['a text flag', { cloudRev: 3, cloudId: 'a', dirty: 'no' }],
    ['a text number', { cloudRev: '3', cloudId: 'a', dirty: false }],
  ])('takes %s as never synced', (_name, sync) => {
    const loaded = load(JSON.stringify({ ...fresh(), sync })).save;
    expect(loaded.sync).toEqual(NEVER_SYNCED);
  });

  it('rounds a fractional cloud number down', () => {
    const sync = { cloudRev: 3.7, cloudId: 'a', dirty: false };
    expect(load(JSON.stringify({ ...fresh(), sync })).save.sync.cloudRev).toBe(3);
  });

  it('gives a new save the never-synced copy, as its own object', () => {
    const save = fresh();
    expect(save.sync).toEqual(NEVER_SYNCED);
    expect(save.sync).not.toBe(NEVER_SYNCED);
  });
});

describe('withProgressChanged', () => {
  it('sets the flag and keeps the cloud copy', () => {
    const save = { ...fresh(), sync: { cloudRev: 2, cloudId: 'z', dirty: false } };
    expect(withProgressChanged(save).sync).toEqual({ cloudRev: 2, cloudId: 'z', dirty: true });
  });

  it('returns the same save when the flag is already up', () => {
    const save = fresh();
    expect(withProgressChanged(save)).toBe(save);
  });
});
