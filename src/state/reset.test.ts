import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../core/save/defaults';
import { withProgressReset } from './reset';

describe('withProgressReset', () => {
  it('starts like the first launch but keeps the install id and the settings', () => {
    const old = createDefaultSave(1000, 'install-1');
    const played: typeof old = {
      ...old,
      coins: 900,
      berries: 40,
      bakerLevel: 7,
      creatures: { honey: { level: 3 } },
      tutorial: { firstRunDone: true, hintsShown: ['tutorial', 'tap'] },
      purchases: { removeAds: true, starterPack: true },
      settings: { ...old.settings, sfx: false, lang: 'ru', reducedFx: 'on' },
      iap: { processedTx: ['tx-1', 'tx-2'] },
      review: { askedVersion: '0.1.0', askedAt: 4000, playDays: 4, lastPlayDay: '2026-11-20' },
      stats: { ...old.stats, runs: 30, flies: 12 },
      records: { ...old.records, classicHeight: 60, dailyBest: 44 },
      prevDay: { day: '2026-11-19', bestHeight: 33 },
      sync: { cloudRev: 5, cloudId: 'cloud-5', dirty: false },
    };
    const next = withProgressReset(played, 5000);
    expect(next).toEqual({
      ...createDefaultSave(5000, 'install-1'),
      settings: played.settings,
      iap: played.iap,
      review: played.review,
      sync: { cloudRev: 5, cloudId: 'cloud-5', dirty: true },
    });
    expect(next.stats.flies).toBe(0);
    expect(next.records.dailyBest).toBe(0);
    expect(next.prevDay).toEqual({ day: '', bestHeight: 0 });
    expect(next.tutorial.hintsShown).toEqual([]);
    expect(next.purchases.removeAds).toBe(false);
  });
});
