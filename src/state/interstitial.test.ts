import { describe, expect, it } from 'vitest';
import { createDefaultSave } from '../core/save/defaults';
import { shownTodayCount, withInterstitialShown } from './interstitial';

const base = createDefaultSave(0, 'test');
const save = { ...base, ads: { ...base.ads, shownDay: '2026-06-10', shownToday: 5 } };

describe('daily interstitial count', () => {
  it('starts over on a later day, not on a clock that looks set back', () => {
    expect(shownTodayCount(save, '2026-06-10', false)).toBe(5);
    expect(shownTodayCount(save, '2026-06-11', false)).toBe(0);
    expect(shownTodayCount(save, '2026-06-11', true)).toBe(5);
    expect(shownTodayCount(save, '2026-06-09', false)).toBe(5);
  });

  it('counts a show on the stored day and keeps the later day on a set-back clock', () => {
    expect(withInterstitialShown(save, 1, '2026-06-11', false).ads).toMatchObject({
      shownDay: '2026-06-11',
      shownToday: 1,
    });
    expect(withInterstitialShown(save, 1, '2026-06-09', false).ads).toMatchObject({
      shownDay: '2026-06-10',
      shownToday: 6,
    });
  });
});
