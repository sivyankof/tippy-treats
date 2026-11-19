import { BALANCE } from '../../data/tower/balance';
import {
  CHECKPOINT_HEIGHTS,
  CHECKPOINT_START_WIDTH,
  type CheckpointHeight,
} from '../../data/zones/checkpoints';
import { addUsed, usedToday, type DayCounter } from '../progression/day-count';
import type { RunMode } from '../run/run-result';
import { zoneIndexOf } from './zones';

export { CHECKPOINT_HEIGHTS, type CheckpointHeight };

/** How a checkpoint start is paid for. */
export type CheckpointMethod = 'ad' | 'berries';

export function isCheckpointHeight(height: number): height is CheckpointHeight {
  return (CHECKPOINT_HEIGHTS as readonly number[]).includes(height);
}

/** Checkpoints a classic tower of this height has reached, lowest first. */
export function checkpointsReached(height: number): CheckpointHeight[] {
  return CHECKPOINT_HEIGHTS.filter((h) => h <= Math.floor(height));
}

/**
 * The opened checkpoints after a classic run reached `height`: every checkpoint opened before
 * stays open, and reaching a height opens every checkpoint at or below it.
 */
export function withReached(opened: readonly number[], height: number): CheckpointHeight[] {
  const top = Math.max(Math.floor(height), ...opened.filter(isCheckpointHeight));
  return checkpointsReached(top);
}

/** Berries a start from this checkpoint costs. */
export function checkpointBerryPrice(height: CheckpointHeight): number {
  return BALANCE.checkpoints.berries[height];
}

/** A rewarded ad can pay for a start from this checkpoint (the low ones only). */
export function checkpointHasAd(height: CheckpointHeight): boolean {
  return (BALANCE.checkpoints.adHeights as readonly number[]).includes(height);
}

/** Ad starts left today; a new local day starts the count over (`core/progression/day-count.ts`). */
export function checkpointAdsLeft(ads: DayCounter, today: string, clockBack: boolean): number {
  return Math.max(0, BALANCE.checkpoints.adsPerDay - usedToday(ads, today, clockBack));
}

/** The counter after one more ad start today. */
export function withCheckpointAdUsed(
  ads: DayCounter,
  today: string,
  clockBack: boolean,
): DayCounter {
  return addUsed(ads, 1, today, clockBack);
}

/** Width of the first flying layer of a run from this checkpoint (data table, from `npm run sim`). */
export function checkpointStartWidth(height: CheckpointHeight): number {
  return CHECKPOINT_START_WIDTH[height];
}

/** Only a classic run that is not the tutorial run may start from a checkpoint. */
export function checkpointRunAllowed(mode: RunMode, tutorial: boolean): boolean {
  return mode === 'classic' && !tutorial;
}

/** How the ad button of a checkpoint row looks. */
export type CheckpointAdState =
  /** No ad for this checkpoint (80, 100, the free start, a locked step). */
  | 'none'
  /** An open low checkpoint whose ad starts are used up today: no button, a caption says why. */
  | 'spent'
  | 'ready'
  /** The ad did not load: grey "Ad unavailable". */
  | 'unavailable';

/** One row of the "Where from?" window, lowest first; height 0 is the free start. */
export interface CheckpointRow {
  height: 0 | CheckpointHeight;
  /** Zone the first flying layer of this start is in (index into `ZONES`). */
  zoneIndex: number;
  /** Not reached yet: grey with a lock and "reach N layers". */
  locked: boolean;
  /** Berry price, 0 for the free start. */
  berries: number;
  /** Berries missing for the price (0 when affordable or free). */
  missing: number;
  ad: CheckpointAdState;
}

export interface CheckpointRowsInput {
  opened: readonly number[];
  berries: number;
  adReady: boolean;
  adsLeft: number;
}

/** Rows of the start choice: the free start, then every checkpoint, open or locked. */
export function checkpointRows(input: CheckpointRowsInput): CheckpointRow[] {
  const free: CheckpointRow = {
    height: 0,
    zoneIndex: zoneIndexOf(1),
    locked: false,
    berries: 0,
    missing: 0,
    ad: 'none',
  };
  const rows = CHECKPOINT_HEIGHTS.map((height): CheckpointRow => {
    const locked = !input.opened.includes(height);
    const berries = checkpointBerryPrice(height);
    const hasAd = !locked && checkpointHasAd(height);
    const spent = hasAd && input.adsLeft <= 0;
    return {
      height,
      zoneIndex: zoneIndexOf(height + 1),
      locked,
      berries,
      missing: Math.max(0, berries - Math.max(0, Math.floor(input.berries))),
      ad: !hasAd ? 'none' : spent ? 'spent' : input.adReady ? 'ready' : 'unavailable',
    };
  });
  return [free, ...rows];
}

/** Highest opened checkpoint, 0 when none is open (the `checkpoint_offer.max_height` field). */
export function highestOpened(opened: readonly number[]): number {
  return Math.max(0, ...opened.filter(isCheckpointHeight));
}
