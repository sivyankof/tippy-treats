import { BALANCE } from '../data/balance';
import type { Modifiers } from './abilities/types';
import type { Rng } from './rng';

const C = BALANCE.coins;

/** Coins that follow a caramel-style multiplier: `base * (1 + coinMultAdd)`. */
export function multipliedCoins(base: number, mods: Pick<Modifiers, 'coinMultAdd'>): number {
  return base * (1 + mods.coinMultAdd);
}

/**
 * Rolls the floating coin of a freshly spawned layer: its x, or `null` when there is none.
 * `restX` is the resting centre of the tower top (without wobble).
 */
export function rollFloatingCoin(rng: Rng, index: number, restX: number): number | null {
  if (index < C.fromLayer || !rng.chance(C.spawnChance)) return null;
  return restX + rng.range(-C.maxOffset, C.maxOffset);
}

/** The coin is caught when it lies within the landed layer (after the cut, before combo widening). */
export function coinCovered(coinX: number, layerX: number, layerWidth: number): boolean {
  return Math.abs(coinX - layerX) <= layerWidth / 2;
}

export function floatingCoinAmount(mods: Pick<Modifiers, 'coinMultAdd'>): number {
  return multipliedCoins(C.collectAmount, mods);
}

/** Coins of a perfect drop in a long enough combo; `combo` already includes this drop. */
export function comboCoinAmount(combo: number, mods: Pick<Modifiers, 'coinMultAdd'>): number {
  return combo >= C.comboFrom ? multipliedCoins(C.comboAmount, mods) : 0;
}

/** Crumb: one coin per `pixelsPerCoin` of the cut edge, never multiplied. */
export function crumbCoinAmount(cutWidth: number, pixelsPerCoin: number | null): number {
  return pixelsPerCoin === null ? 0 : Math.floor(cutWidth / pixelsPerCoin);
}

/** Coins added at run end for the reached height. */
export function heightBonusCoins(height: number): number {
  return Math.floor(height / C.heightBonusEvery) * C.heightBonusCoins;
}
