import { services } from '../../services';
import { gameState } from '../../state';
import type {
  AdsService,
  RewardedPlacement,
  RewardedReasonParam,
  RewardedResult,
  RewardedUnavailableReason,
} from '../../services/rewarded-video/types';

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
 * The `reason` of `ad_rewarded_result`. After a failed show the service is already loading the
 * next ad, so its answer is often `loading`; the event keeps its two values and writes it as
 * `no_fill` (docs/09-services-analytics.md, section 3).
 */
function reasonParam(reason: RewardedUnavailableReason | null): RewardedReasonParam | null {
  return reason === 'loading' ? 'no_fill' : reason;
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
  const reason =
    result === 'unavailable' ? reasonParam(services.ads.rewardedUnavailableReason()) : null;
  services.telemetry.logEvent(
    'ad_rewarded_result',
    reason ? { placement, result, reason } : { placement, result },
  );
  if (result === 'rewarded') {
    watchedInRun = true;
    gameState.countAdWatched();
  }
  return result;
}

/** The rewarded half of the ad service as the run scene hands it to the continue offer. */
export const rewardedAds: Pick<
  AdsService,
  'isRewardedReady' | 'rewardedUnavailableReason' | 'showRewarded'
> = {
  isRewardedReady: () => services.ads.isRewardedReady(),
  rewardedUnavailableReason: () => services.ads.rewardedUnavailableReason(),
  showRewarded,
};
