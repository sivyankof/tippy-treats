import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/tower/balance';
import { CHECKPOINT_START_WIDTH } from '../data/zones/checkpoints';
import {
  checkpointAdsLeft,
  checkpointBerryPrice,
  checkpointHasAd,
  checkpointRows,
  checkpointRunAllowed,
  checkpointStartWidth,
  checkpointsReached,
  highestOpened,
  isCheckpointHeight,
  withCheckpointAdUsed,
  withReached,
} from './checkpoints';

describe('checkpoints', () => {
  it('opens every checkpoint at or below the reached height', () => {
    expect(checkpointsReached(0)).toEqual([]);
    expect(checkpointsReached(19)).toEqual([]);
    expect(checkpointsReached(20)).toEqual([20]);
    expect(checkpointsReached(67)).toEqual([20, 40, 60]);
    expect(checkpointsReached(250)).toEqual([20, 40, 60, 80, 100]);
  });

  it('never closes an opened checkpoint', () => {
    expect(withReached([20, 40, 60], 30)).toEqual([20, 40, 60]);
    expect(withReached([20], 85)).toEqual([20, 40, 60, 80]);
    expect(withReached([], 0)).toEqual([]);
  });

  it('knows checkpoint heights', () => {
    expect(isCheckpointHeight(40)).toBe(true);
    expect(isCheckpointHeight(0)).toBe(false);
    expect(isCheckpointHeight(41)).toBe(false);
  });

  it('prices from the balance data, ads only for 20, 40 and 60', () => {
    expect([20, 40, 60, 80, 100].map((h) => checkpointBerryPrice(h as 20))).toEqual([
      5, 10, 15, 25, 40,
    ]);
    expect([20, 40, 60, 80, 100].map((h) => checkpointHasAd(h as 20))).toEqual([
      true,
      true,
      true,
      false,
      false,
    ]);
    expect(checkpointStartWidth(60)).toBe(CHECKPOINT_START_WIDTH[60]);
  });

  it('counts ad starts per local day', () => {
    const max = BALANCE.checkpoints.adsPerDay;
    expect(checkpointAdsLeft({ day: '', used: 0 }, '2026-11-15', false)).toBe(max);
    const once = withCheckpointAdUsed({ day: '', used: 0 }, '2026-11-15', false);
    expect(checkpointAdsLeft(once, '2026-11-15', false)).toBe(max - 1);
    expect(checkpointAdsLeft({ day: '2026-11-15', used: max }, '2026-11-15', false)).toBe(0);
    expect(checkpointAdsLeft({ day: '2026-11-15', used: max }, '2026-11-16', false)).toBe(max);
    // A clock set back does not refill the count.
    expect(checkpointAdsLeft({ day: '2026-11-15', used: max }, '2026-11-16', true)).toBe(0);
  });

  it('allows a checkpoint start only in a classic run that is not the tutorial', () => {
    expect(checkpointRunAllowed('classic', false)).toBe(true);
    expect(checkpointRunAllowed('daily', false)).toBe(false);
    expect(checkpointRunAllowed('classic', true)).toBe(false);
  });

  it('builds the rows of the start choice', () => {
    const rows = checkpointRows({ opened: [20, 40, 60], berries: 12, adReady: true, adsLeft: 2 });
    expect(rows.map((r) => r.height)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(rows.map((r) => r.zoneIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(rows[0]).toMatchObject({ locked: false, berries: 0, missing: 0, ad: 'none' });
    expect(rows[1]).toMatchObject({ locked: false, berries: 5, missing: 0, ad: 'ready' });
    expect(rows[3]).toMatchObject({ locked: false, berries: 15, missing: 3, ad: 'ready' });
    expect(rows[4]).toMatchObject({ locked: true, ad: 'none' });
    expect(rows[5]).toMatchObject({ locked: true, ad: 'none' });
  });

  it('shows the ad as unavailable when it did not load, and none when today is used up', () => {
    const opened = [20, 40, 60, 80, 100];
    const off = checkpointRows({ opened, berries: 0, adReady: false, adsLeft: 3 });
    expect(off.map((r) => r.ad)).toEqual([
      'none',
      'unavailable',
      'unavailable',
      'unavailable',
      'none',
      'none',
    ]);
    const spent = checkpointRows({ opened, berries: 0, adReady: true, adsLeft: 0 });
    expect(spent.map((r) => r.ad)).toEqual(['none', 'spent', 'spent', 'spent', 'none', 'none']);
  });

  it('reports the highest opened checkpoint', () => {
    expect(highestOpened([])).toBe(0);
    expect(highestOpened([20, 40])).toBe(40);
  });
});
