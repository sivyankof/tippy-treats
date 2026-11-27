import type * as Phaser from 'phaser';
import { APP_VERSION } from '../../../../data/app/app-info';
import { REVIEW } from '../../../../data/app/review';
import { services } from '../../../../services';
import { gameState } from '../../../../state';
import { backHandlerCount } from '../../../app/back-stack';
import { interstitialDue, type RunExit } from '../../../economy/interstitial-flow';
import type { ScreenAd } from './screen-ad';

/** What the request looks at on the results screen. */
export interface RatingInput {
  exit: RunExit;
  /** The results of a daily tower run: the request never comes there. */
  daily: boolean;
  /** The player is leaving or sharing. */
  busy: () => boolean;
  /** The "x2 coins" ad of the screen. */
  ad: ScreenAd;
}

/** What the request touches outside the screen (injected in tests). */
export interface RatingDeps {
  canAsk: typeof gameState.canAskForReview;
  noteAsked: (version: string) => void;
  request: () => void;
  interstitialDue: (exit: RunExit) => boolean;
  windowCount: () => number;
}

const LIVE: RatingDeps = {
  canAsk: (version, facts) => gameState.canAskForReview(version, facts),
  noteAsked: (version) => {
    gameState.noteReviewAsked(version);
    gameState.flush();
  },
  request: () => void services.rating.requestReview(),
  interstitialDue,
  windowCount: backHandlerCount,
};

/**
 * Asks the system for a rating on the results of a run, once the animations of the screen are
 * over (docs/04-meta-retention.md, section 10): waits `REVIEW.afterAnimationsMs`, then asks the
 * rules with what is true by then. A window opened in the meantime (a purchase, a start from a
 * checkpoint) or a way out already taken stops it. When the "x2" ad was on at that check, the
 * rules are asked once more, `REVIEW.afterAnimationsMs` after the ad has closed. The timers belong
 * to the scene, so leaving the screen cancels them. The request is noted in the save before the
 * system is asked. Call it when the screen has played everything.
 */
export function askForRatingOnResults(
  scene: Phaser.Scene,
  input: RatingInput,
  deps: RatingDeps = LIVE,
): void {
  // The windows that were open when the screen finished its animations belong to the screen.
  const baseline = deps.windowCount();
  const check = (again: boolean): void => {
    if (!scene.scene.isActive() || !input.exit.recorded) return;
    const adOn = input.ad.showing();
    const due = deps.canAsk(APP_VERSION, {
      daily: input.daily,
      newRecord: input.exit.newRecord,
      newCreature: input.exit.newCreature,
      interstitialDue: deps.interstitialDue(input.exit),
      busy: adOn || input.busy() || deps.windowCount() > baseline,
    });
    if (due) {
      deps.noteAsked(APP_VERSION);
      deps.request();
      return;
    }
    if (adOn && !again) {
      input.ad.onceClosed(() =>
        scene.time.delayedCall(REVIEW.afterAnimationsMs, () => check(true)),
      );
    }
  };
  scene.time.delayedCall(REVIEW.afterAnimationsMs, () => check(false));
}
