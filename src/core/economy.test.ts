import { describe, expect, it } from 'vitest';
import { CREATURES, CREATURE_IDS } from '../data/creatures';
import { BERRY_PACKS, UPGRADE_COSTS } from '../data/economy';
import {
  buyCreature,
  canAfford,
  creaturePrice,
  duplicateCompensation,
  earn,
  exchangeBerries,
  grantCreature,
  spend,
  upgradeCost,
  upgradeCreature,
  type EconomySlice,
} from './economy';

const slice = (over: Partial<EconomySlice> = {}): EconomySlice => ({
  coins: 0,
  berries: 0,
  bakerLevel: 1,
  creatures: { honey: { level: 1 } },
  ...over,
});

describe('wallet', () => {
  it('checks both currencies', () => {
    expect(canAfford({ coins: 10, berries: 1 }, { coins: 10, berries: 1 })).toBe(true);
    expect(canAfford({ coins: 10, berries: 0 }, { coins: 10, berries: 1 })).toBe(false);
    expect(canAfford({ coins: 0, berries: 0 }, {})).toBe(true);
  });

  it('spend never goes negative', () => {
    expect(spend({ coins: 5, berries: 0 }, { coins: 6 })).toBeNull();
    expect(spend({ coins: 5, berries: 2 }, { coins: 5, berries: 2 })).toEqual({
      coins: 0,
      berries: 0,
    });
  });

  it('earn adds and ignores negative gains', () => {
    expect(earn({ coins: 1, berries: 1 }, { coins: 4, berries: 2 })).toEqual({
      coins: 5,
      berries: 3,
    });
    expect(earn({ coins: 1, berries: 1 }, { coins: -4 })).toEqual({ coins: 1, berries: 1 });
  });

  it('earn takes whole numbers only and ignores NaN and infinity', () => {
    expect(earn({ coins: 1, berries: 1 }, { coins: 2.9, berries: Number.NaN })).toEqual({
      coins: 3,
      berries: 1,
    });
    expect(earn({ coins: 1, berries: 1 }, { coins: Infinity })).toEqual({ coins: 1, berries: 1 });
  });

  it('rejects negative and non-finite costs', () => {
    const wallet = { coins: 10, berries: 10 };
    for (const cost of [
      { coins: -5 },
      { berries: -1 },
      { coins: Number.NaN },
      { coins: Infinity },
    ]) {
      expect(canAfford(wallet, cost)).toBe(false);
      expect(spend(wallet, cost)).toBeNull();
    }
    expect(spend(wallet, { coins: 0.5 })).toEqual({ coins: 9, berries: 10 });
  });
});

describe('creaturePrice', () => {
  it('reads the prices from the creature data', () => {
    expect(creaturePrice('jelly', 1)).toEqual([{ currency: 'coins', price: 300 }]);
    expect(creaturePrice('crumb', 8)).toEqual([{ currency: 'coins', price: 1200 }]);
    expect(creaturePrice('lemon', 12)).toEqual([
      { currency: 'coins', price: 2500 },
      { currency: 'berries', price: 250 },
    ]);
    expect(creaturePrice('rainbow', 5)).toEqual([{ currency: 'berries', price: 600 }]);
  });

  it('hides a price below the baker level', () => {
    expect(creaturePrice('frosty', 3)).toEqual([]);
    expect(creaturePrice('frosty', 4)).toEqual([{ currency: 'coins', price: 900 }]);
    expect(creaturePrice('rainbow', 4)).toEqual([]);
  });

  it('has nothing for creatures that are not sold', () => {
    expect(creaturePrice('honey', 99)).toEqual([]);
    expect(creaturePrice('brownie', 99)).toEqual([]);
  });

  it('every price in the data matches the rarity table of the docs', () => {
    const coinPrice = { common: 300, rare: 900, epic: 2500 } as const;
    for (const id of CREATURE_IDS) {
      for (const option of creaturePrice(id, 99)) {
        if (option.currency === 'coins' && id !== 'crumb') {
          const rarity = CREATURES[id].rarity;
          if (rarity !== 'legendary') expect(option.price).toBe(coinPrice[rarity]);
        }
      }
    }
  });
});

describe('buyCreature', () => {
  it('buys and pays', () => {
    const result = buyCreature(slice({ coins: 350 }), 'jelly', 'coins');
    expect(result).toEqual({
      ok: true,
      value: {
        coins: 50,
        berries: 0,
        bakerLevel: 1,
        creatures: { honey: { level: 1 }, jelly: { level: 1 } },
      },
    });
  });

  it('cannot buy twice', () => {
    const first = buyCreature(slice({ coins: 1000 }), 'jelly', 'coins');
    if (!first.ok) throw new Error('first buy failed');
    expect(buyCreature(first.value, 'jelly', 'coins')).toEqual({ ok: false, reason: 'owned' });
    expect(first.value.coins).toBe(700);
  });

  it('is locked below the baker level or for a currency it is not sold in', () => {
    expect(buyCreature(slice({ coins: 9999 }), 'frosty', 'coins')).toEqual({
      ok: false,
      reason: 'locked',
    });
    expect(buyCreature(slice({ coins: 9999, bakerLevel: 4 }), 'frosty', 'berries')).toEqual({
      ok: false,
      reason: 'locked',
    });
    expect(buyCreature(slice({ coins: 9999 }), 'brownie', 'coins')).toEqual({
      ok: false,
      reason: 'locked',
    });
  });

  it('refuses without enough money and leaves the slice alone', () => {
    const start = slice({ coins: 299 });
    expect(buyCreature(start, 'jelly', 'coins')).toEqual({ ok: false, reason: 'not_enough' });
    expect(start.coins).toBe(299);
  });

  it('pays in berries', () => {
    const result = buyCreature(slice({ berries: 600, bakerLevel: 5 }), 'rainbow', 'berries');
    expect(result.ok && result.value.berries).toBe(0);
  });
});

describe('upgrades', () => {
  it('costs come from the data and end at level 5', () => {
    expect([1, 2, 3, 4].map(upgradeCost)).toEqual([...UPGRADE_COSTS]);
    expect([150, 400, 900, 2000]).toEqual([...UPGRADE_COSTS]);
    expect(upgradeCost(5)).toBeNull();
  });

  it('upgrades and pays', () => {
    const result = upgradeCreature(slice({ coins: 200 }), 'honey');
    expect(result).toMatchObject({
      ok: true,
      value: { coins: 50, creatures: { honey: { level: 2 } } },
    });
  });

  it('refuses at the maximum level, when not owned, or without coins', () => {
    const maxed = slice({ coins: 9999, creatures: { honey: { level: 5 } } });
    expect(upgradeCreature(maxed, 'honey')).toEqual({ ok: false, reason: 'max_level' });
    expect(upgradeCreature(slice({ coins: 9999 }), 'puff')).toEqual({
      ok: false,
      reason: 'not_owned',
    });
    expect(upgradeCreature(slice({ coins: 149 }), 'honey')).toEqual({
      ok: false,
      reason: 'not_enough',
    });
  });
});

describe('exchangeBerries', () => {
  it('uses the pack table', () => {
    expect(BERRY_PACKS.map((pack) => [pack.berries, pack.coins])).toEqual([
      [10, 100],
      [50, 600],
      [100, 1400],
    ]);
    const result = exchangeBerries(slice({ berries: 120, coins: 5 }), 50);
    expect(result).toMatchObject({ ok: true, value: { berries: 70, coins: 605 } });
  });

  it('refuses unknown packs and a short wallet', () => {
    expect(exchangeBerries(slice({ berries: 500 }), 20)).toEqual({
      ok: false,
      reason: 'unknown_pack',
    });
    expect(exchangeBerries(slice({ berries: 99 }), 100)).toEqual({
      ok: false,
      reason: 'not_enough',
    });
  });
});

describe('creature reward the player already owns', () => {
  it('pays half the price in the currency the creature sells for, coins first', () => {
    expect(duplicateCompensation('rainbow')).toEqual({ berries: 300 });
    expect(duplicateCompensation('lemon')).toEqual({ coins: 1250 });
    expect(duplicateCompensation('crumb')).toEqual({ coins: 600 });
    expect(duplicateCompensation('jelly')).toEqual({ coins: 150 });
  });

  it('pays nothing for a creature the shop never sells', () => {
    expect(duplicateCompensation('puff')).toEqual({});
    expect(duplicateCompensation('brownie')).toEqual({});
  });

  it('hands over a new creature at level 1', () => {
    const grant = grantCreature(slice(), 'rainbow');
    expect(grant.duplicate).toBeNull();
    expect(grant.value.creatures.rainbow).toEqual({ level: 1 });
    expect(grant.value.berries).toBe(0);
  });

  it('keeps the owned creature and its level, and pays the compensation', () => {
    const owned = slice({ berries: 5, creatures: { honey: { level: 1 }, rainbow: { level: 3 } } });
    const grant = grantCreature(owned, 'rainbow');
    expect(grant.duplicate).toEqual({ berries: 300 });
    expect(grant.value.creatures.rainbow).toEqual({ level: 3 });
    expect(grant.value.berries).toBe(305);
    expect(grant.value.coins).toBe(0);
  });
});
