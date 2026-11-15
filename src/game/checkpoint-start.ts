import {
  checkpointBerryPrice,
  checkpointHasAd,
  highestOpened,
  type CheckpointHeight,
  type CheckpointMethod,
} from '../core/checkpoints';
import { services } from '../services';
import type { RewardedResult } from '../services/rewarded-video/types';
import type { AnalyticsService } from '../services/telemetry/types';
import { gameState } from '../state';
import type { GameState } from '../state/game-state';
import { carryRewardedIntoNextRun, showRewarded } from './rewarded';

/**
 * How paying for a start from a checkpoint ended:
 * `paid`: the start is paid for (berries spent or the ad start counted), the caller starts the run;
 * `short`: the berries are not enough, nothing was spent;
 * `dismissed`: the ad was closed without a reward, nothing counted or spent;
 * `unavailable`: no ad is ready;
 * `refused`: not allowed (locked checkpoint, no ad for this height, today's ad starts used up,
 * or another payment is still going).
 */
export type CheckpointPayResult = 'paid' | 'short' | 'dismissed' | 'unavailable' | 'refused';

export interface CheckpointStartDeps {
  state: Pick<GameState, 'checkpoints' | 'berries' | 'checkpointAdsLeft' | 'payCheckpoint'>;
  /** Whether a rewarded ad is loaded. */
  adReady: () => boolean;
  showRewarded: (placement: 'checkpoint_start') => Promise<RewardedResult>;
  telemetry: Pick<AnalyticsService, 'logEvent'>;
  /** The ad paid for the run that starts next: it counts as a rewarded ad of that run. */
  carryReward?: () => void;
}

function liveDeps(): CheckpointStartDeps {
  return {
    state: gameState,
    adReady: () => services.ads.isRewardedReady(),
    showRewarded,
    telemetry: services.telemetry,
    carryReward: carryRewardedIntoNextRun,
  };
}

/** A payment is going (an ad may be showing): a second tap must not pay again. */
let inFlight = false;

/**
 * Pays for a start from `height`. Berries are spent at once; an ad start is shown through
 * `showRewarded` and counted only after a full view. Logs `checkpoint_start` (and `currency_spend`
 * for berries) when it is paid. The caller starts the run on `paid`.
 */
export async function payForCheckpoint(
  height: CheckpointHeight,
  method: CheckpointMethod,
  deps: CheckpointStartDeps = liveDeps(),
): Promise<CheckpointPayResult> {
  if (inFlight) return 'refused';
  inFlight = true;
  try {
    return await pay(height, method, deps);
  } finally {
    inFlight = false;
  }
}

async function pay(
  height: CheckpointHeight,
  method: CheckpointMethod,
  deps: CheckpointStartDeps,
): Promise<CheckpointPayResult> {
  const { state } = deps;
  if (!state.checkpoints.includes(height)) return 'refused';
  const price = checkpointBerryPrice(height);
  if (method === 'berries') {
    if (state.berries < price) return 'short';
    if (!state.payCheckpoint(height, 'berries')) return 'refused';
    deps.telemetry.logEvent('currency_spend', {
      currency: 'berries',
      amount: price,
      item: `checkpoint_${height}`,
    });
    logStart(deps, height, method, price);
    return 'paid';
  }
  if (!checkpointHasAd(height) || state.checkpointAdsLeft <= 0) return 'refused';
  if (!deps.adReady()) return 'unavailable';
  const shown = await deps.showRewarded('checkpoint_start');
  if (shown !== 'rewarded') return shown;
  if (!state.payCheckpoint(height, 'ad')) return 'refused';
  deps.carryReward?.();
  logStart(deps, height, method, 0);
  return 'paid';
}

function logStart(
  deps: CheckpointStartDeps,
  height: CheckpointHeight,
  method: CheckpointMethod,
  price: number,
): void {
  deps.telemetry.logEvent('checkpoint_start', { height, method, price });
}

/** The start choice window opened: logs `checkpoint_offer` with the highest opened checkpoint. */
export function logCheckpointOffer(
  deps: Pick<CheckpointStartDeps, 'state' | 'telemetry'> = liveDeps(),
): void {
  deps.telemetry.logEvent('checkpoint_offer', {
    max_height: highestOpened(deps.state.checkpoints),
  });
}
