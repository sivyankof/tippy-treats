import { describe, expect, it } from 'vitest';
import { CREATURE_IDS, MAX_CREATURE_LEVEL } from '../data/creatures';
import { abilityChanges, abilityValues } from './ability-values';

describe('ability values', () => {
  it('fills the placeholders of every creature at every level', () => {
    for (const id of CREATURE_IDS) {
      for (let level = 1; level <= MAX_CREATURE_LEVEL; level++) {
        expect(abilityValues(id, level).value, `${id} ${level}`).toBeGreaterThan(0);
      }
    }
  });

  it('reads the level values', () => {
    expect(abilityValues('honey', 2)).toEqual({ value: 34 });
    expect(abilityValues('sprinkle', 3)).toEqual({ value: 2.5 });
    expect(Object.keys(abilityValues('jelly', 1)).sort()).toEqual(['layers', 'percent', 'value']);
  });

  it('lists what grows with the next level', () => {
    expect(abilityChanges('ghost', 1, 2)).toEqual([]);
    expect(abilityChanges('ghost', 2, 3)).toEqual([['value', 3, 4]]);
  });
});
