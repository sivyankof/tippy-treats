import { describe, expect, it } from 'vitest';
import { RARITIES } from './rarity';
import {
  CREATURE_IDS,
  CREATURES,
  abilityDef,
  clampLevel,
  levelValue,
  type CreatureId,
} from './creatures';

describe('creature catalog', () => {
  it('has 12 creatures keyed by their own id', () => {
    expect(CREATURE_IDS).toHaveLength(12);
    for (const id of CREATURE_IDS) {
      const def = CREATURES[id];
      expect(def.id).toBe(id);
      expect(def.ability.kind).toBe(id);
      expect(def.nameKey).toBe(`creature.${id}.name`);
      expect(def.descKey).toBe(`creature.${id}.desc`);
      expect(def.unlock.length).toBeGreaterThan(0);
      expect(def.palette.body).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('matches the rarity counts of the design (4 / 4 / 3 / 1)', () => {
    const count = (r: string) =>
      CREATURE_IDS.filter((id: CreatureId) => CREATURES[id].rarity === r).length;
    expect(RARITIES.map(count)).toEqual([4, 4, 3, 1]);
  });

  it('keeps the alternative unlocks of crumb, lemon and rainbow', () => {
    expect(CREATURES.crumb.unlock).toHaveLength(2);
    expect(CREATURES.lemon.unlock).toEqual([
      { kind: 'shop', coins: 2500, minBakerLevel: 12 },
      { kind: 'shop', berries: 250, minBakerLevel: 12 },
    ]);
    expect(CREATURES.rainbow.unlock).toHaveLength(2);
  });

  it('has five values for every per-level table', () => {
    for (const id of CREATURE_IDS) {
      for (const value of Object.values(CREATURES[id].ability)) {
        if (Array.isArray(value)) expect(value).toHaveLength(5);
      }
    }
  });
});

describe('level helpers', () => {
  it('clamps levels to 1..5', () => {
    expect([-3, 0, 1, 3.7, 5, 6].map(clampLevel)).toEqual([1, 1, 1, 3, 5, 5]);
  });

  it('picks the value of the level', () => {
    const values = [10, 20, 30, 40, 50] as const;
    expect([1, 2, 5, 0, 9].map((l) => levelValue(values, l))).toEqual([10, 20, 50, 10, 50]);
    expect(abilityDef('twins').bonusHeight).toBe(1);
  });
});
