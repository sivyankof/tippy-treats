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
    };
    const next = withProgressReset(played, 5000);
    expect(next).toEqual({
      ...createDefaultSave(5000, 'install-1'),
      settings: played.settings,
    });
    expect(next.tutorial.hintsShown).toEqual([]);
    expect(next.purchases.removeAds).toBe(false);
  });
});
