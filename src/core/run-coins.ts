import { BALANCE } from '../data/tower/balance';
import type { Modifiers } from './abilities/types';
import {
  coinCovered,
  comboCoinAmount,
  crumbCoinAmount,
  floatingCoinAmount,
  heightBonusCoins,
  rollFloatingCoin,
} from './coins';
import type { Rng } from './rng';
import type { CoinSource, EmitEvent, PlacedLayer, SimEvent, TowerState } from './sim-types';

/** Wraps an event list as an emitter. */
function into(events: SimEvent[]): EmitEvent {
  return (event) => events.push(event);
}

/** Adds coins to the run and announces them; zero and negative amounts are ignored. */
export function gainCoins(
  s: TowerState,
  emit: EmitEvent,
  amount: number,
  source: CoinSource,
): void {
  if (amount <= 0) return;
  s.coins += amount;
  emit({ type: 'coin_collect', amount, source });
}

/** Rolls the floating coin of a new layer index above the tower top at `restX`. */
export function spawnFloatingCoin(
  s: TowerState,
  events: SimEvent[],
  coinRng: Rng,
  index: number,
  restX: number,
): void {
  const x = rollFloatingCoin(coinRng.fork(`layer:${index}`), index, restX);
  s.floatingCoinX = x;
  if (x !== null) events.push({ type: 'coin_spawn', x });
}

/** Pays the floating coin when the landed layer covers it. */
export function collectFloatingCoin(
  s: TowerState,
  events: SimEvent[],
  coinX: number | null,
  layer: PlacedLayer,
  mods: Readonly<Modifiers>,
): void {
  if (coinX !== null && coinCovered(coinX, layer.x, layer.width)) {
    gainCoins(s, into(events), floatingCoinAmount(mods), 'floating');
  }
}

/**
 * Coins and berries a landing pays besides the floating coin. `cutWidth` is what a normal drop
 * cut off, also when a protected layer kept it.
 */
export function payLanding(
  s: TowerState,
  events: SimEvent[],
  golden: boolean,
  perfect: boolean,
  cutWidth: number,
  mods: Readonly<Modifiers>,
): void {
  if (perfect) {
    gainCoins(s, into(events), comboCoinAmount(s.combo, mods), 'combo');
    gainCoins(s, into(events), mods.perfectCoinAdd, 'perfect');
  } else {
    gainCoins(s, into(events), crumbCoinAmount(cutWidth, mods.crumbToCoinsPx), 'crumb');
  }
  if (!golden) return;
  events.push({ type: 'golden', perfect });
  if (perfect) {
    s.berries += BALANCE.golden.perfectBerries;
    s.score += BALANCE.score.goldenPerfectBonus;
  } else {
    gainCoins(s, into(events), BALANCE.golden.normalCoins, 'golden');
  }
}

/**
 * Coins for the height climbed in this run, paid once when the run ends. A run from a checkpoint
 * counts only the layers above `startHeight`.
 */
export function payHeightBonus(s: TowerState, events: SimEvent[], startHeight = 0): void {
  gainCoins(s, into(events), heightBonusCoins(s.height - startHeight), 'height');
}
