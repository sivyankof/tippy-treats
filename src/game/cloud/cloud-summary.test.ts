import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../../core/save/defaults';
import { agoOf, formatSavedAt, summarize } from './cloud-summary';

describe('summarize', () => {
  it('counts what the windows show', () => {
    const base = createDefaultSave(0, 'x');
    const save = {
      ...base,
      bakerLevel: 9,
      coins: 1250,
      berries: 35,
      records: { ...base.records, classicHeight: 87 },
      creatures: { ...base.creatures, puff: { level: 2 } },
    };
    expect(summarize(save, 5)).toEqual({
      bakerLevel: 9,
      record: 87,
      creatures: Object.keys(save.creatures).length,
      coins: 1250,
      berries: 35,
      savedAt: 5,
    });
  });
});

describe('agoOf', () => {
  const T = 1_800_000_000_000;
  it.each([
    [0, { key: 'now', n: 0 }],
    [59_999, { key: 'now', n: 0 }],
    [60_000, { key: 'min', n: 1 }],
    [59 * 60_000, { key: 'min', n: 59 }],
    [3 * 3600_000, { key: 'h', n: 3 }],
    [2 * 86_400_000 + 5, { key: 'd', n: 2 }],
    [-5000, { key: 'now', n: 0 }],
  ])('%i ms ago', (ago, expected) => {
    expect(agoOf(T - ago, T)).toEqual(expected);
  });
});

describe('formatSavedAt', () => {
  it('writes day, month and time in the language', () => {
    const ms = new Date(2026, 10, 28, 14, 5).getTime();
    expect(formatSavedAt(ms, 'en')).toMatch(/Nov/);
    expect(formatSavedAt(ms, 'en')).toMatch(/28/);
    expect(formatSavedAt(ms, 'en')).toMatch(/2:05|14:05/);
    expect(formatSavedAt(ms, 'ru')).toMatch(/28/);
    expect(formatSavedAt(ms, 'ru')).toMatch(/14:05/);
  });
});
