import { services } from '../services';
import type {
  AdsService,
  RewardedPlacement,
  RewardedResult,
} from '../services/rewarded-video/types';

/** A rewarded ad was watched since the current run began (the interstitial rule 4). */
let watchedInRun = false;

/** A new run begins: the memory of rewarded ads watched starts over. */
export function beginRunRewardedMemo(): void {
  watchedInRun = false;
}

/** The player watched a rewarded ad (the continue offer, the ×2 coins) during the current run. */
export function rewardedWatchedInRun(): boolean {
  return watchedInRun;
}

/**
 * The only way the game asks for a rewarded ad. A broken ad service counts as `unavailable`; a
 * `rewarded` answer is remembered for the interstitial rules. The caller pays the reward.
 */
export async function showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
  let result: RewardedResult;
  try {
    result = await services.ads.showRewarded(placement);
  } catch {
    result = 'unavailable';
  }
  if (result === 'rewarded') watchedInRun = true;
  return result;
}

/** The rewarded half of the ad service as the run scene hands it to the continue offer. */
export const rewardedAds: Pick<AdsService, 'isRewardedReady' | 'showRewarded'> = {
  isRewardedReady: () => services.ads.isRewardedReady(),
  showRewarded,
};
