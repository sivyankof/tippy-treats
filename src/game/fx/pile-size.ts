import { PILE_FROM, type PileCurrency, type PileSize } from '../../data/economy/treasure-piles';

/** The size of the pile picture for an amount of coins or berries (1 = a few, 4 = the biggest). */
export function pileSizeFor(currency: PileCurrency, amount: number): PileSize {
  const from = PILE_FROM[currency];
  if (amount >= from[3]) return 4;
  if (amount >= from[2]) return 3;
  if (amount >= from[1]) return 2;
  return 1;
}
