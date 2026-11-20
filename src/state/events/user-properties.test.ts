import { describe, expect, it, vi } from 'vitest';
import { createDefaultSave } from '../../core/save/defaults';
import { MS_PER_DAY } from '../../data/app/clock';
import { bucketOf, UserPropertySync, userPropertiesOf } from './user-properties';

const T0 = 1_700_000_000_000;
const fresh = () => createDefaultSave(T0, 'install');

describe('userPropertiesOf', () => {
  it('describes a new save', () => {
    expect(userPropertiesOf(fresh(), T0)).toEqual({
      baker_level: '1',
      creatures_owned: '1',
      best_height_bucket: '0-19',
      payer: '0',
      install_age_bucket: '0',
    });
  });

  it('buckets the best height', () => {
    const at = (classicHeight: number) =>
      userPropertiesOf(
        { ...fresh(), records: { classicHeight, classicScore: 0, bestCombo: 0 } },
        T0,
      ).best_height_bucket;
    expect([at(19), at(20), at(49), at(50), at(99), at(100), at(500)]).toEqual([
      '0-19',
      '20-49',
      '20-49',
      '50-99',
      '50-99',
      '100+',
      '100+',
    ]);
  });

  it('buckets the age of the install in whole days', () => {
    const at = (days: number) =>
      userPropertiesOf(fresh(), T0 + days * MS_PER_DAY).install_age_bucket;
    expect([at(0), at(1), at(2), at(3), at(5), at(10), at(20), at(31), at(400)]).toEqual([
      '0',
      '1',
      '2-3',
      '2-3',
      '4-7',
      '8-14',
      '15-30',
      '31+',
      '31+',
    ]);
    // A clock before the install never gives a negative day.
    expect(userPropertiesOf(fresh(), T0 - MS_PER_DAY).install_age_bucket).toBe('0');
  });

  it('marks a payer by any purchase', () => {
    const save = fresh();
    expect(
      userPropertiesOf({ ...save, purchases: { removeAds: true, starterPack: false } }, T0).payer,
    ).toBe('1');
    expect(userPropertiesOf({ ...save, iap: { processedTx: ['tx'] } }, T0).payer).toBe('1');
  });

  it('never carries the install id', () => {
    const save = createDefaultSave(T0, 'secret-install-id-123');
    expect(JSON.stringify(userPropertiesOf(save, T0))).not.toContain('secret-install-id-123');
    expect(Object.keys(userPropertiesOf(save, T0))).not.toContain('installId');
  });
});

describe('bucketOf', () => {
  it('takes the first bucket the value fits, else the last name', () => {
    const buckets = [
      { upTo: 1, name: 'a' },
      { upTo: 5, name: 'b' },
    ];
    expect([
      bucketOf(1, buckets, 'z'),
      bucketOf(2, buckets, 'z'),
      bucketOf(6, buckets, 'z'),
    ]).toEqual(['a', 'b', 'z']);
  });
});

describe('UserPropertySync', () => {
  it('sends every property once, then only the ones that changed', () => {
    const analytics = { logEvent: vi.fn(), setUserProperty: vi.fn() };
    const sync = new UserPropertySync(analytics);
    sync.sync(fresh(), T0);
    expect(analytics.setUserProperty).toHaveBeenCalledTimes(5);
    analytics.setUserProperty.mockClear();
    sync.sync(fresh(), T0);
    expect(analytics.setUserProperty).not.toHaveBeenCalled();
    sync.sync({ ...fresh(), bakerLevel: 2 }, T0);
    expect(analytics.setUserProperty).toHaveBeenCalledOnce();
    expect(analytics.setUserProperty).toHaveBeenCalledWith('baker_level', '2');
  });
});
