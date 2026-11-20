import { SAMPLE_AD_UNITS } from '../../data/economy/rewarded-video';

export type AdPlatform = 'ios' | 'android';

/** The two ad units of a platform; a missing one means that kind of ad is not shown at all. */
export interface AdUnits {
  rewarded?: string;
  interstitial?: string;
}

/** The ad unit ids a store build is given at build time (`.env`, docs/09-services-analytics.md, section 3). */
export type AdUnitEnv = Partial<
  Record<
    | 'VITE_ADMOB_REWARDED_ID_IOS'
    | 'VITE_ADMOB_INTERSTITIAL_ID_IOS'
    | 'VITE_ADMOB_REWARDED_ID_ANDROID'
    | 'VITE_ADMOB_INTERSTITIAL_ID_ANDROID',
    string
  >
>;

const clean = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Which ad units to use. With the debug tools (dev server, internal build) always Google's sample
 * units; the store build takes its own from the environment, and a unit it was not given stays
 * missing: no ads of that kind, never a sample ad.
 */
export function pickAdUnits(options: {
  debugTools: boolean;
  platform: AdPlatform;
  env: AdUnitEnv;
}): AdUnits {
  const { debugTools, platform, env } = options;
  if (debugTools) return { ...SAMPLE_AD_UNITS[platform] };
  const ios = platform === 'ios';
  return {
    rewarded: clean(ios ? env.VITE_ADMOB_REWARDED_ID_IOS : env.VITE_ADMOB_REWARDED_ID_ANDROID),
    interstitial: clean(
      ios ? env.VITE_ADMOB_INTERSTITIAL_ID_IOS : env.VITE_ADMOB_INTERSTITIAL_ID_ANDROID,
    ),
  };
}
