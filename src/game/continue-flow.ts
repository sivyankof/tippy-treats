import { continueOffer, type ContinueOffer } from '../core/continue-offer';
import type { RunMode } from '../core/run-result';
import { BALANCE } from '../data/balance';
import { CONTINUE_ANIM } from '../data/continue-anim';
import { continueInput } from './continue-input';
import type { AdsService } from '../services/rewarded-video/types';
import type { GameState } from '../state/game-state';

export type ContinueAction = 'continue' | 'decline';

export interface ContinueFlowDeps {
  ads: Pick<AdsService, 'isRewardedReady' | 'showRewarded'>;
  /** The save: the berry balance and the payment. */
  wallet: Pick<GameState, 'berries' | 'spendBerries'>;
  /** The save: the runs finished before this one (the first runs have no window). */
  player: Pick<GameState, 'runsFinished'>;
}

/**
 * State of the "Continue?" offer after a miss, with no drawing: the offer, the 5 second timer
 * and the ways out. The scene opens it, feeds it time and takes the decision once it is made.
 * The timer stands still while an ad shows.
 */
export class ContinueFlow {
  private current: ContinueOffer | null = null;
  private elapsed = 0;
  private left = 0;
  private adShowing = false;
  private pending: ContinueAction | null = null;
  private disposed = false;
  /** Time left of the pause after a payment, while the window shows the berries flying. */
  private holdMs = 0;

  constructor(private readonly deps: ContinueFlowDeps) {}

  get isOpen(): boolean {
    return this.current !== null;
  }

  get offer(): Readonly<ContinueOffer> | null {
    return this.current;
  }

  get adBusy(): boolean {
    return this.adShowing;
  }

  /** A payment was made and the window is still showing it. */
  get paying(): boolean {
    return this.holdMs > 0;
  }

  /** Berries the player holds now: the number the window's balance counter shows. */
  get balance(): number {
    return this.deps.wallet.berries;
  }

  get remainingMs(): number {
    return this.left;
  }

  get elapsedMs(): number {
    return this.elapsed;
  }

  /** The buttons of the window are live (they all switch on at the same moment). */
  get inputReady(): boolean {
    return continueInput(this.elapsed).active;
  }

  /** Opens the offer; false (nothing opened) when the window must not be shown at all. */
  open(mode: RunMode, continuesUsed: number): boolean {
    const offer = continueOffer({
      mode,
      continuesUsed,
      adReady: this.deps.ads.isRewardedReady(),
      berries: this.deps.wallet.berries,
      runsBefore: this.deps.player.runsFinished,
    });
    if (!offer) return false;
    this.current = { ...offer };
    this.elapsed = 0;
    this.left = BALANCE.continues.offerMs;
    this.pending = null;
    this.holdMs = 0;
    return true;
  }

  /** Advances the timer; at zero the offer is declined. */
  update(dtMs: number): void {
    if (this.holdMs > 0) this.holdMs = Math.max(0, this.holdMs - dtMs);
    if (!this.current || this.pending) return;
    this.elapsed += dtMs;
    if (this.adShowing) return;
    this.left = Math.max(0, this.left - dtMs);
    if (this.left <= 0) this.pending = 'decline';
  }

  /** The "No thanks" button. Ignored before the buttons switch on. */
  decline(): void {
    if (this.current && !this.adShowing && !this.pending && this.inputReady)
      this.pending = 'decline';
  }

  /** Pays the berry price from the wallet; false when there is no such offer or not enough. */
  payWithBerries(): boolean {
    const cost = this.current?.berryCost ?? null;
    if (cost === null || !this.inputReady || this.adShowing || this.pending) return false;
    if (!this.deps.wallet.spendBerries(cost)) return false;
    this.pending = 'continue';
    this.holdMs = CONTINUE_ANIM.balance.paidHoldMs;
    return true;
  }

  /**
   * Shows the rewarded ad (`showRewarded` mutes the sound and counts it). A reward continues the run, closing the ad
   * returns to the window with the timer running again, `unavailable` disables the button.
   */
  async watchAd(): Promise<void> {
    if (this.current?.ad !== 'ready' || !this.inputReady || this.adShowing || this.pending) return;
    this.adShowing = true;
    const result = await this.deps.ads.showRewarded('continue');
    this.adShowing = false;
    if (this.disposed || !this.current) return;
    if (result === 'rewarded') this.pending = 'continue';
    else if (result === 'unavailable') this.current = { ...this.current, ad: 'unavailable' };
  }

  /** The decision once it is made, then `null` until the next offer. Closes the offer. */
  takeAction(): ContinueAction | null {
    const action = this.pending;
    if (!action || this.holdMs > 0) return null;
    this.pending = null;
    this.current = null;
    return action;
  }

  /** The run is gone: a late ad result must change nothing. */
  dispose(): void {
    this.disposed = true;
    this.current = null;
    this.pending = null;
    this.holdMs = 0;
  }
}
