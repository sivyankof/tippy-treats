import { services } from '../services';
import { gameState } from '../state';
import type {
  AdsService,
  RewardedPlacement,
  RewardedResult,
} from '../services/rewarded-video/types';

/** A rewarded ad was watched since the current run began (the interstitial rule 4). */
let watchedInRun = false;

/**
 * A new run begins: the memory of rewarded ads watched starts over. `watchedBeforeRun`: a rewarded
 * ad paid for the start of this run, so it counts as watched in it (docs/05, section 6).
 */
export function beginRunRewardedMemo(watchedBeforeRun = false): void {
  watchedInRun = watchedBeforeRun;
}

/** The player watched a rewarded ad (the continue offer, the ×2 coins) during the current run. */
export function rewardedWatchedInRun(): boolean {
  return watchedInRun;
}

/**
 * The only way the game asks for a rewarded ad. The sound is suspended while it shows; a broken
 * ad service counts as `unavailable`; a `rewarded` answer is counted in the stats and remembered
 * for the interstitial rules. The caller pays the reward.
 */
export async function showRewarded(placement: RewardedPlacement): Promise<RewardedResult> {
  let result: RewardedResult;
  services.telemetry.logEvent('ad_rewarded_show', { placement });
  services.audio.suspend('ad');
  try {
    result = await services.ads.showRewarded(placement);
  } catch {
    result = 'unavailable';
  } finally {
    services.audio.resume('ad');
  }
  services.telemetry.logEvent(
    'ad_rewarded_result',
    result === 'unavailable'
      ? { placement, result, reason: services.ads.rewardedUnavailableReason() ?? 'no_fill' }
      : { placement, result },
  );
  if (result === 'rewarded') {
    watchedInRun = true;
    gameState.countAdWatched();
  }
  return result;
}

/** The rewarded half of the ad service as the run scene hands it to the continue offer. */
export const rewardedAds: Pick<AdsService, 'isRewardedReady' | 'showRewarded'> = {
  isRewardedReady: () => services.ads.isRewardedReady(),
  showRewarded,
};
