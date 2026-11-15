import type * as Phaser from 'phaser';
import { shouldOfferRemoveAds } from '../core/video-policy';
import { services } from '../services';
import { gameState } from '../state';
import { loadPrices } from './purchases';
import { rewardedWatchedInRun } from './rewarded';
import { openNoAdsOffer } from './ui/menu/no-ads-offer';

/** What this launch of the app has shown so far; a new launch starts over. */
const session = { shown: 0, offered: false };

/** What the results screen knows about the run it is leaving. */
export interface RunExit {
  /** How long the run lasted, pauses excluded. */
  runMs: number;
  /** The run reached the save (false for the dev bot and start-height runs). */
  recorded: boolean;
}

/** After the second interstitial of the session, once: the "No ads" offer, if the store gave its price. */
async function offerRemoveAds(scene: Phaser.Scene): Promise<void> {
  if (!shouldOfferRemoveAds(gameState.data.purchases.removeAds, session.shown, session.offered))
    return;
  const price = (await loadPrices()).remove_ads;
  if (price === undefined || !scene.scene.isActive()) return;
  session.offered = true;
  await new Promise<void>((resolve) => openNoAdsOffer(scene, price, resolve));
}

/**
 * The player is leaving the results: shows an interstitial when the rules of `core/video-policy.ts`
 * say so, then the "No ads" offer when it is due. Resolves when the way on is free.
 */
export async function leaveResultsAds(scene: Phaser.Scene, exit: RunExit): Promise<void> {
  if (!exit.recorded || !gameState.canShowInterstitial(exit.runMs, rewardedWatchedInRun())) return;
  services.audio.suspend('ad');
  let shown: boolean;
  try {
    shown = await services.ads.showInterstitial();
  } catch {
    shown = false;
  }
  services.audio.resume('ad');
  if (!shown) return;
  gameState.noteInterstitialShown();
  gameState.flush();
  session.shown += 1;
  await offerRemoveAds(scene);
}
