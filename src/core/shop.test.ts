import { describe, expect, it } from 'vitest';
import { MS_PER_DAY } from '../data/clock';
import { PRODUCTS, SHOP } from '../data/shop';
import { createDefaultSave } from './save/defaults';
import type { Save } from './save/schema';
import {
  coinCreatureAffordable,
  freeCoinsLeft,
  productOwned,
  shopCreatures,
  starterPackContents,
  starterPackEnd,
  starterPackMsLeft,
  starterPackInShop,
  starterPackOnHome,
  withFreeCoinsClaimed,
  withProductGranted,
  withPurchasesRestored,
  withStarterPackShown,
} from './shop';

const T0 = 1_700_000_000_000;
const save = (over: Partial<Save> = {}): Save => ({ ...createDefaultSave(T0, 'id'), ...over });

describe('starter pack offer', () => {
  const WEEK = SHOP.starterPackDays * MS_PER_DAY;
  const shop = (shownAt: number, until = 0): Save['shop'] => ({
    freeCoinsDay: '',
    freeCoinsUsed: 0,
    starterPackUntil: until,
    starterPackShownAt: shownAt,
  });
  const withRuns = (runs: number, over: Partial<Save> = {}): Save =>
    save({ stats: { runs, totalLayers: 0, perfects: 0, adsWatched: 0 }, ...over });

  it('keeps Home without the pack until the 10th finished run', () => {
    expect(starterPackOnHome(withRuns(0), T0)).toBe(false);
    expect(starterPackOnHome(withRuns(9), T0)).toBe(false);
    expect(starterPackOnHome(withRuns(10), T0)).toBe(true);
    // The window only starts at the first show, so time since the install does not matter.
    expect(starterPackOnHome(withRuns(10), T0 + 100 * MS_PER_DAY)).toBe(true);
  });

  it('offers the pack in the shop from the start, without a timer before the first show', () => {
    expect(starterPackInShop(withRuns(0), T0 + 100 * MS_PER_DAY)).toBe(true);
    expect(starterPackEnd(withRuns(0))).toBeNull();
    expect(starterPackMsLeft(withRuns(0), T0)).toBeNull();
  });

  it('runs the window for a week from the first show on Home', () => {
    const shown = withRuns(12, { shop: shop(T0 + MS_PER_DAY) });
    expect(starterPackEnd(shown)).toBe(T0 + MS_PER_DAY + WEEK);
    expect(starterPackMsLeft(shown, T0 + 2 * MS_PER_DAY)).toBe(WEEK - MS_PER_DAY);
    expect(starterPackOnHome(shown, T0 + MS_PER_DAY + WEEK - 1)).toBe(true);
    expect(starterPackInShop(shown, T0 + MS_PER_DAY + WEEK - 1)).toBe(true);
    expect(starterPackOnHome(shown, T0 + MS_PER_DAY + WEEK)).toBe(false);
    expect(starterPackInShop(shown, T0 + MS_PER_DAY + WEEK)).toBe(false);
    expect(starterPackMsLeft(shown, T0 + 100 * MS_PER_DAY)).toBe(0);
  });

  it('is gone once bought, in the shop and on Home', () => {
    const purchases = { removeAds: false, starterPack: true };
    expect(starterPackInShop(withRuns(0, { purchases }), T0)).toBe(false);
    expect(starterPackOnHome(withRuns(10, { purchases }), T0)).toBe(false);
  });

  it('keeps the first show once it is set', () => {
    const first = withStarterPackShown(withRuns(10), T0 + 5);
    expect(first.shop.starterPackShownAt).toBe(T0 + 5);
    expect(withStarterPackShown(first, T0 + 99)).toBe(first);
  });

  it('lets a saved end time override the first show', () => {
    const s = withRuns(10, { shop: shop(0, T0 + 5) });
    expect(starterPackEnd(s)).toBe(T0 + 5);
    expect(starterPackInShop(s, T0 + 6)).toBe(false);
    expect(starterPackMsLeft(s, T0)).toBe(5);
  });
});

describe('starter pack contents', () => {
  const grant = PRODUCTS.starter_pack.grant;

  it('gives the creature, the coins and the berries', () => {
    expect(starterPackContents({ honey: { level: 1 } })).toEqual({
      creature: 'crumb',
      coins: 500,
      berries: 60,
    });
  });

  it('gives coins instead of a creature that is owned already', () => {
    expect(starterPackContents({ honey: { level: 1 }, crumb: { level: 3 } })).toEqual({
      creature: null,
      coins: 500 + (grant.duplicateCoins ?? 0),
      berries: 60,
    });
    expect(grant.duplicateCoins).toBe(1200);
  });
});

describe('free coins for an ad', () => {
  const shop = (day: string, used: number): Save['shop'] => ({
    freeCoinsDay: day,
    freeCoinsUsed: used,
    starterPackUntil: 0,
    starterPackShownAt: 0,
  });

  it('allows three a day and starts over with a new day', () => {
    expect(freeCoinsLeft(shop('', 0), '2026-11-15')).toBe(SHOP.freeCoins.perDay);
    expect(freeCoinsLeft(shop('2026-11-15', 2), '2026-11-15')).toBe(SHOP.freeCoins.perDay - 2);
    expect(freeCoinsLeft(shop('2026-11-15', 3), '2026-11-15')).toBe(0);
    expect(freeCoinsLeft(shop('2026-11-15', 3), '2026-11-16')).toBe(SHOP.freeCoins.perDay);
  });

  it('pays the coins and counts the ad, then stops after the last one', () => {
    let current = save();
    for (let i = 1; i <= SHOP.freeCoins.perDay; i++) {
      const next = withFreeCoinsClaimed(current, '2026-11-15');
      expect(next).not.toBeNull();
      if (!next) return;
      current = next;
      expect(current.coins).toBe(SHOP.freeCoins.amount * i);
      expect(current.shop.freeCoinsUsed).toBe(i);
    }
    expect(withFreeCoinsClaimed(current, '2026-11-15')).toBeNull();
    const tomorrow = withFreeCoinsClaimed(current, '2026-11-16');
    expect(tomorrow?.shop).toMatchObject({ freeCoinsDay: '2026-11-16', freeCoinsUsed: 1 });
  });

  it('keeps a stale count of an earlier day from blocking today', () => {
    const s = save({ shop: shop('2026-11-14', 3) });
    expect(withFreeCoinsClaimed(s, '2026-11-15')?.shop.freeCoinsUsed).toBe(1);
  });
});

describe('creatures for coins', () => {
  it('lists the unowned ones the baker level opens, cheapest first', () => {
    const level1 = shopCreatures(save());
    expect(level1.length).toBeGreaterThan(0);
    expect(level1.every((entry) => entry.id !== 'honey')).toBe(true);
    const prices = level1.map((entry) => entry.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    const level12 = shopCreatures(save({ bakerLevel: 12 }));
    expect(level12.length).toBeGreaterThan(level1.length);
    expect(level12.map((entry) => entry.id)).toContain('crumb');
    expect(level1.map((entry) => entry.id)).not.toContain('crumb');
  });

  it('drops an owned creature', () => {
    const first = shopCreatures(save())[0];
    expect(first).toBeDefined();
    if (!first) return;
    const owned = save({ creatures: { honey: { level: 1 }, [first.id]: { level: 1 } } });
    expect(shopCreatures(owned).map((entry) => entry.id)).not.toContain(first.id);
  });

  it('says whether one of them is affordable', () => {
    const cheapest = shopCreatures(save())[0]?.price ?? 0;
    expect(coinCreatureAffordable(save({ coins: cheapest - 1 }))).toBe(false);
    expect(coinCreatureAffordable(save({ coins: cheapest }))).toBe(true);
  });
});

describe('what a purchase gives', () => {
  it('pays berries for a pack, again and again', () => {
    const once = withProductGranted(save({ berries: 5 }), 'berries_80');
    expect(once?.berries).toBe(85);
    if (!once) return;
    expect(withProductGranted(once, 'berries_500')?.berries).toBe(585);
    expect(withProductGranted(once, 'berries_80')?.berries).toBe(165);
  });

  it('switches ads off once', () => {
    const once = withProductGranted(save(), 'remove_ads');
    expect(once?.purchases.removeAds).toBe(true);
    expect(once?.coins).toBe(0);
    if (!once) return;
    expect(withProductGranted(once, 'remove_ads')).toBeNull();
  });

  it('gives the starter pack once: the creature, 500 coins and 60 berries', () => {
    const bought = withProductGranted(save({ coins: 10, berries: 1 }), 'starter_pack');
    expect(bought?.creatures.crumb).toEqual({ level: 1 });
    expect(bought?.coins).toBe(510);
    expect(bought?.berries).toBe(61);
    expect(bought?.purchases.starterPack).toBe(true);
    if (!bought) return;
    expect(withProductGranted(bought, 'starter_pack')).toBeNull();
  });

  it('gives 1200 coins instead of an owned creature and keeps its level', () => {
    const s = save({ creatures: { honey: { level: 1 }, crumb: { level: 4 } } });
    const bought = withProductGranted(s, 'starter_pack');
    expect(bought?.creatures.crumb).toEqual({ level: 4 });
    expect(bought?.coins).toBe(1700);
    expect(bought?.berries).toBe(60);
  });

  it('knows which products are one-time and owned', () => {
    const s = save({ purchases: { removeAds: true, starterPack: false } });
    expect(productOwned(s, 'remove_ads')).toBe(true);
    expect(productOwned(s, 'starter_pack')).toBe(false);
    expect(productOwned(s, 'berries_80')).toBe(false);
  });
});

describe('restoring purchases', () => {
  it('switches ads off again after a progress reset, without a payout', () => {
    const restored = withPurchasesRestored(save(), ['remove_ads']);
    expect(restored.purchases.removeAds).toBe(true);
    expect(restored.coins).toBe(0);
  });

  it('ends the starter offer and returns its creature but not its coins', () => {
    const restored = withPurchasesRestored(save(), ['starter_pack']);
    expect(restored.purchases.starterPack).toBe(true);
    expect(restored.creatures.crumb).toEqual({ level: 1 });
    expect(restored.coins).toBe(0);
    expect(restored.berries).toBe(0);
  });

  it('changes nothing when the save already agrees', () => {
    const s = save({
      purchases: { removeAds: true, starterPack: true },
      creatures: { honey: { level: 1 }, crumb: { level: 2 } },
    });
    expect(withPurchasesRestored(s, ['remove_ads', 'starter_pack'])).toBe(s);
    const fresh = save();
    expect(withPurchasesRestored(fresh, [])).toBe(fresh);
  });
});
