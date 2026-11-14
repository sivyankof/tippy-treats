import type * as Phaser from 'phaser';
import { gameState } from '../../../state';
import { openStreakCalendar, type StreakClosed } from './streak-calendar';
import type { WalletTargets } from './reward-flight';
import { openStreakThreat } from './streak-threat';

export { openStreakCalendar, openStreakThreat };
export type { StreakClosed };

/**
 * What the player meets on the first entry of the day: the threat window when the streak is about
 * to break, then the calendar with today's reward. Calls `onDone` with the claim (or null) when
 * nothing is left to show.
 */
export function openStreakEntry(
  scene: Phaser.Scene,
  wallet: WalletTargets,
  onDone: StreakClosed,
): void {
  const entry = gameState.streakEntry();
  if (entry.kind === 'threat') {
    openStreakThreat(scene, () => openStreakEntry(scene, wallet, onDone));
  } else if (entry.kind === 'claim') {
    openStreakCalendar(scene, onDone, wallet);
  } else {
    onDone(null);
  }
}
