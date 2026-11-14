// Coins, berries and counters outside a run, as pure functions over the save.
import type { Save } from '../core/save/schema';

/** The save with `coins` added; the same save when nothing whole and positive is given. */
export function withCoins(save: Save, coins: number): Save {
  const whole = Math.floor(coins);
  if (!(whole > 0)) return save;
  return { ...save, coins: save.coins + whole };
}

/** The save with `berries` added; the same save when nothing whole and positive is given. */
export function withBerries(save: Save, berries: number): Save {
  const whole = Math.floor(berries);
  if (!(whole > 0)) return save;
  return { ...save, berries: save.berries + whole };
}

export function withAdWatched(save: Save): Save {
  return { ...save, stats: { ...save.stats, adsWatched: save.stats.adsWatched + 1 } };
}
