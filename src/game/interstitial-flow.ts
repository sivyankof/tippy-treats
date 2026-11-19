import type * as Phaser from 'phaser';
import { services } from '../services';
import { gameState } from '../state';
import { loadPrices } from './purchases';
import { rewardedWatchedInRun } from './rewarded';
import { openNoAdsOffer } from './ui/menu/shop/premium-offer';

/** What this launch of the app has shown so far; a new launch starts over. */
const session = { shown: 0 };

/** What the results screen knows about the run it is leaving. */
export interface RunExit {
  /** How long the run lasted, pauses excluded. */
  runMs: number;
  /** The run reached the save (false for the dev bot and start-height runs). */
  recorded: boolean;
  /** The run beat the best height. */
  newRecord: boolean;
  /** The run raised the baker level. */
  levelUp: boolean;
  /** A creature comes with the results (a level reward, the first Honey). */
  newCreature: boolean;
}

/** The "No ads" offer of one Home entry: its price is asked for at once, the window opens later. */
export interface RemoveAdsOffer {
  /** Settles when the price has come (or the offer is not due). */
  readonly ready: Promise<void>;
  /**
   * Opens the offer at once, when nothing else is open: only if it is due (the second
   * interstitial of the session is behind, none offered today) and the price has already come.
   * There is no waiting here, so no window of the player can be opened in between; without a
   * price nothing is shown and the day is not used up, the next Home entry tries again.
   */
  open(scene: Phaser.Scene): void;
}

/** Starts the offer of a Home entry: call it as Home appears, `open` once the day windows are closed. */
export function prepareRemoveAdsOffer(): RemoveAdsOffer {
  let price: string | undefined;
  const ready = gameState.removeAdsOfferDue(session.shown)
    ? loadPrices().then((prices) => {
        price = prices.remove_ads;
      })
    : Promise.resolve();
  return {
    ready,
    open(scene: Phaser.Scene): void {
      if (price === undefined || !scene.scene.isActive()) return;
      if (!gameState.removeAdsOfferDue(session.shown)) return;
      gameState.noteRemoveAdsOffered();
      gameState.flush();
      openNoAdsOffer(scene, price, () => undefined);
    },
  };
}

/**
 * The player is leaving the results: shows an interstitial when the rules of `core/economy/video-policy.ts`
 * say so. The "No ads" offer does not delay the way on: it waits for Home. Resolves when the way is free.
 */
export async function leaveResultsAds(exit: RunExit): Promise<void> {
  if (!exit.recorded) return;
  const { runMs, newRecord, levelUp, newCreature } = exit;
  const facts = { runMs, newRecord, levelUp, newCreature };
  if (
    !gameState.canShowInterstitial({
      ...facts,
      rewardedInRun: rewardedWatchedInRun(),
      shownInSession: session.shown,
    })
  ) {
    return;
  }
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
}
