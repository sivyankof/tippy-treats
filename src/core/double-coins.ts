import { REWARDED_OFFERS } from '../data/economy/rewarded-video';
import { addUsed, usedToday, type DayCounter } from './day-count';

/** "×2 coins" ads left today; a new local day starts the count over. */
export function doublesLeft(doubles: DayCounter, today: string, clockBack: boolean): number {
  return Math.max(0, REWARDED_OFFERS.doubleCoinsPerDay - usedToday(doubles, today, clockBack));
}

/** The counter after one more doubling today. */
export function withDoubleUsed(doubles: DayCounter, today: string, clockBack: boolean): DayCounter {
  return addUsed(doubles, 1, today, clockBack);
}
