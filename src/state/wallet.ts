// Coins, berries and counters outside a run, as pure functions over the save.
import { earn } from '../core/economy';
import type { Save } from '../core/save/schema';

/** The save with `coins` added; the same save when nothing whole and positive is given. */
export function withCoins(save: Save, coins: number): Save {
  const next = earn(save, { coins });
  return next.coins === save.coins ? save : next;
}

/** The save with `berries` added; the same save when nothing whole and positive is given. */
export function withBerries(save: Save, berries: number): Save {
  const next = earn(save, { berries });
  return next.berries === save.berries ? save : next;
}

export function withAdWatched(save: Save): Save {
  return { ...save, stats: { ...save.stats, adsWatched: save.stats.adsWatched + 1 } };
}
