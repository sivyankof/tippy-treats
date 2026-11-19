import { describe, expect, it } from 'vitest';
import { checkpointRows } from '../../../../core/zones/checkpoints';
import { buttonsFor, keepSelection } from './checkpoint-model';

const rows = (opened: number[], berries: number, adReady = true) =>
  checkpointRows({ opened, berries, adReady, adsLeft: 3 });

describe('keepSelection', () => {
  it('keeps an open step', () => {
    expect(keepSelection(rows([20, 40], 50), 40)).toBe(40);
  });

  it('falls back to the free start when the step is locked or missing', () => {
    expect(keepSelection(rows([20], 50), 40)).toBe(0);
    expect(keepSelection(rows([], 0).slice(0, 1), 20)).toBe(0);
  });
});

describe('buttonsFor', () => {
  const rowAt = (list: ReturnType<typeof rows>, height: number) => {
    const row = list.find((candidate) => candidate.height === height);
    if (!row) throw new Error('no row');
    return row;
  };

  it('the free start has only Play', () => {
    expect(buttonsFor(rowAt(rows([20], 0), 0))).toEqual({
      main: { kind: 'free' },
      ad: 'hidden',
      adSpent: false,
    });
  });

  it('a locked step has no way to start', () => {
    expect(buttonsFor(rowAt(rows([20], 30), 40))).toEqual({
      main: { kind: 'none' },
      ad: 'hidden',
      adSpent: false,
    });
  });

  it('a paid step shows the price, the shortfall and the ad state', () => {
    const list = rows([20, 80], 3);
    const short = buttonsFor(rowAt(list, 20));
    expect(short.main).toEqual({ kind: 'pay', price: 5, missing: 2 });
    expect(short.ad).toBe('ready');
    expect(buttonsFor(rowAt(list, 80)).ad).toBe('hidden');
    expect(buttonsFor(rowAt(rows([20], 30, false), 20)).ad).toBe('unavailable');
  });

  it('with the ad starts used up the ad button is hidden and a caption is asked for', () => {
    const spent = checkpointRows({ opened: [20, 80], berries: 30, adReady: true, adsLeft: 0 });
    expect(buttonsFor(rowAt(spent, 20))).toMatchObject({ ad: 'hidden', adSpent: true });
    expect(buttonsFor(rowAt(spent, 80))).toMatchObject({ ad: 'hidden', adSpent: false });
  });
});
