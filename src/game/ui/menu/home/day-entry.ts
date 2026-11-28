import type * as Phaser from 'phaser';
import { backHandlerCount } from '../../../app/back-stack';
import { gameState } from '../../../../state';
import type { StreakClaim } from '../../../../state/game-state';
import { prepareRemoveAdsOffer } from '../../../economy/interstitial-flow';
import { openOvenWindow } from '../oven/oven-window';
import { openStreakEntry } from '../streak/streak-windows';
import type { WalletTargets } from '../widgets/reward-flight';
import { pickDayWindow } from './day-window';

/** True on the first Home entry of the player's life (and marks it as seen). */
export function takeFirstHome(): boolean {
  const first = !gameState.hasHint('homeSeen') && gameState.runsFinished <= 1;
  gameState.markHint('homeSeen');
  return first;
}

export interface DayEntryHooks {
  wallet: WalletTargets;
  /** The player left Home meanwhile. */
  isLeaving(): boolean;
  /** The streak window closed with this claim (or none). */
  onStreak(claim: StreakClaim | null): void;
}

/**
 * Opens the one window of the day that fits this Home entry (docs/07-ui-screens.md, section 2):
 * the streak, the oven explainer or the "No ads" offer, never more than one.
 */
export function openDayWindow(
  scene: Phaser.Scene,
  options: { firstHome: boolean; askShown: boolean },
  hooks: DayEntryHooks,
): void {
  if (hooks.isLeaving()) return;
  const offer = prepareRemoveAdsOffer();
  const picked = pickDayWindow({
    ...options,
    streakPending: gameState.streakEntry().kind !== 'none',
    ovenPending: !gameState.hasHint('oven'),
    offerPending: offer.due,
  });
  if (picked === 'streak') openStreakEntry(scene, hooks.wallet, hooks.onStreak);
  else if (picked === 'oven') openOvenWindow(scene);
  else if (picked === 'offer') {
    // The price may come late: by then the player may have opened a window (it registers its
    // back) or left. Then the offer waits for another entry instead of covering that window.
    const windows = backHandlerCount();
    void offer.ready.then(() => {
      if (hooks.isLeaving() || !scene.sys.isActive() || backHandlerCount() !== windows) return;
      offer.open(scene);
    });
  }
}
