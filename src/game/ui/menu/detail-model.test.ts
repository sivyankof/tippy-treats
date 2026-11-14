import { describe, expect, it } from 'vitest';
import { upgradeCost } from '../../../core/economy';
import { CREATURE_IDS, MAX_CREATURE_LEVEL } from '../../../data/creatures';
import { changeText, formatValues, mainAction, missingAmount } from './detail-model';

describe('mainAction', () => {
  it('upgrades an owned creature until the maximum level', () => {
    expect(mainAction('honey', 1, 1)).toEqual({ kind: 'upgrade', price: upgradeCost(1) });
    expect(mainAction('honey', MAX_CREATURE_LEVEL, 1)).toEqual({ kind: 'maxLevel' });
  });

  it('gives every locked creature some way to get it', () => {
    for (const id of CREATURE_IDS) {
      for (const bakerLevel of [1, 5, 20]) {
        const action = mainAction(id, null, bakerLevel);
        expect(['buy', 'shopFrom', 'howTo']).toContain(action.kind);
        if (action.kind === 'buy') expect(action.options.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('mainAction for a locked creature', () => {
  it('offers coins first and berries second for Zesty from baker level 12', () => {
    expect(mainAction('lemon', null, 12)).toEqual({
      kind: 'buy',
      options: [
        { currency: 'coins', price: 2500 },
        { currency: 'berries', price: 250 },
      ],
    });
  });

  it('names the baker level a shop creature needs', () => {
    expect(mainAction('lemon', null, 1)).toEqual({ kind: 'shopFrom', minBakerLevel: 12 });
    expect(mainAction('rainbow', null, 1)).toEqual({ kind: 'shopFrom', minBakerLevel: 5 });
  });

  it('explains how to get a creature the shop never sells', () => {
    expect(mainAction('twins', null, 20)).toEqual({
      kind: 'howTo',
      hint: { kind: 'record', height: 75 },
    });
    expect(mainAction('brownie', null, 20)).toEqual({
      kind: 'howTo',
      hint: { kind: 'streak', day: 7 },
    });
    expect(mainAction('puff', null, 1)).toEqual({
      kind: 'howTo',
      hint: { kind: 'bakerLevel', level: 2 },
    });
  });
});

describe('helpers', () => {
  it('counts what is missing', () => {
    expect(missingAmount(400, 150)).toBe(250);
    expect(missingAmount(400, 900)).toBe(0);
  });

  it('formats values and changes', () => {
    const f = (n: number): string => `<${n}>`;
    expect(formatValues({ value: 2 }, f)).toEqual({ value: '<2>' });
    expect(
      changeText(
        [
          ['value', 3, 4],
          ['percent', 10, 20],
        ],
        f,
      ),
    ).toBe('<3> → <4>, <10> → <20>');
    expect(changeText([], f)).toBe('');
  });
});
