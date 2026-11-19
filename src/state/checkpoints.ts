// Start from a checkpoint as pure functions over the save: the opened list and the payment.
import {
  checkpointAdsLeft,
  checkpointBerryPrice,
  checkpointHasAd,
  checkpointRows,
  withCheckpointAdUsed,
  type CheckpointHeight,
  type CheckpointMethod,
  type CheckpointRow,
} from '../core/zones/checkpoints';
import { spend } from '../core/economy/economy';
import type { Save } from '../core/save/schema';

export function checkpointAdsLeftOf(save: Save, today: string, clockBack: boolean): number {
  return checkpointAdsLeft(save.checkpointAds, today, clockBack);
}

export function checkpointRowsOf(
  save: Save,
  adReady: boolean,
  today: string,
  clockBack: boolean,
): CheckpointRow[] {
  return checkpointRows({
    opened: save.checkpoints,
    berries: save.berries,
    adReady,
    adsLeft: checkpointAdsLeftOf(save, today, clockBack),
  });
}

/**
 * The save after paying for a start from `height`, or null (nothing changes) when the checkpoint is
 * not opened, the berries are short, or the ad start is not allowed (no ad for this height or
 * today's ad starts are used up). An ad start only counts; the ad itself is the caller's business.
 */
export function withCheckpointPaid(
  save: Save,
  height: CheckpointHeight,
  method: CheckpointMethod,
  today: string,
  clockBack: boolean,
): Save | null {
  if (!save.checkpoints.includes(height)) return null;
  if (method === 'berries') return spend(save, { berries: checkpointBerryPrice(height) });
  if (!checkpointHasAd(height) || checkpointAdsLeftOf(save, today, clockBack) <= 0) return null;
  return {
    ...save,
    checkpointAds: withCheckpointAdUsed(save.checkpointAds, today, clockBack),
  };
}
