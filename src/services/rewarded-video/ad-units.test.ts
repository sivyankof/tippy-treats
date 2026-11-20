import { describe, expect, it } from 'vitest';
import { SAMPLE_AD_UNITS } from '../../data/economy/rewarded-video';
import { pickAdUnits } from './ad-units';

const env = {
  VITE_ADMOB_REWARDED_ID_IOS: 'real-r-ios',
  VITE_ADMOB_INTERSTITIAL_ID_IOS: 'real-i-ios',
  VITE_ADMOB_REWARDED_ID_ANDROID: 'real-r-and',
  VITE_ADMOB_INTERSTITIAL_ID_ANDROID: ' ',
};

describe('pickAdUnits', () => {
  it('uses the sample units with the debug tools, whatever the environment holds', () => {
    expect(pickAdUnits({ debugTools: true, platform: 'ios', env })).toEqual(SAMPLE_AD_UNITS.ios);
    expect(pickAdUnits({ debugTools: true, platform: 'android', env: {} })).toEqual(
      SAMPLE_AD_UNITS.android,
    );
  });

  it('uses the real units in the store build', () => {
    expect(pickAdUnits({ debugTools: false, platform: 'ios', env })).toEqual({
      rewarded: 'real-r-ios',
      interstitial: 'real-i-ios',
    });
  });

  it('leaves a missing or blank unit out, never falling back to a sample', () => {
    expect(pickAdUnits({ debugTools: false, platform: 'android', env })).toEqual({
      rewarded: 'real-r-and',
      interstitial: undefined,
    });
    expect(pickAdUnits({ debugTools: false, platform: 'ios', env: {} })).toEqual({
      rewarded: undefined,
      interstitial: undefined,
    });
  });
});
