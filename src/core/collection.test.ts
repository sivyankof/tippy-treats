import { describe, expect, it } from 'vitest';
import { collectionCount, unlockHint } from './collection';

describe('unlock hints', () => {
  it('shows the shop price, coins first, with the level it needs', () => {
    expect(unlockHint('jelly')).toEqual({
      kind: 'shop',
      currency: 'coins',
      price: 300,
      minBakerLevel: 1,
    });
    expect(unlockHint('lemon')).toEqual({
      kind: 'shop',
      currency: 'coins',
      price: 2500,
      minBakerLevel: 12,
    });
    expect(unlockHint('crumb')).toEqual({
      kind: 'shop',
      currency: 'coins',
      price: 1200,
      minBakerLevel: 8,
    });
    expect(unlockHint('rainbow')).toEqual({
      kind: 'shop',
      currency: 'berries',
      price: 600,
      minBakerLevel: 5,
    });
  });

  it('shows the free way of a creature the shop does not sell', () => {
    expect(unlockHint('puff')).toEqual({ kind: 'bakerLevel', level: 2 });
    expect(unlockHint('brownie')).toEqual({ kind: 'streak', day: 7 });
    expect(unlockHint('twins')).toEqual({ kind: 'record', height: 75 });
    expect(unlockHint('honey')).toEqual({ kind: 'tutorial' });
  });

  it('counts the owned creatures', () => {
    expect(collectionCount({ honey: { level: 1 }, puff: { level: 2 } })).toEqual({
      owned: 2,
      total: 12,
    });
  });
});
