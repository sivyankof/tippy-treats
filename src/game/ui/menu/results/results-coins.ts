import { canOfferDoubleCoins } from '../../../../core/economy/video-policy';
import * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { formatNumber, t } from '../../../../i18n';
import { services } from '../../../../services';
import { gameState } from '../../../../state';
import type { AdState } from '../../../economy/ad-caption';
import { showRewarded } from '../../../economy/rewarded';
import { TREASURE_TEXTURES, createTreasureTextures } from '../../../fx/economy/treasure-textures';
import { createTextButton, type Button } from '../../common/button';
import { NumberRoll } from '../../common/number-roll';
import { Callout } from '../../style/callout';
import { StatTile } from '../../style/stat-tile';
import {
  adLabelRoom,
  markAdUnavailable,
  plainAdLabel,
  resetAdLabel,
  watchAdState,
} from '../widgets/ad-unavailable';
import { createBreakdown } from './results-coin-breakdown';
import { tileLook } from './results-tiles';
import type { CoinLine } from './results-text';

const cfg = MENU.results;
const adRoom = adLabelRoom(cfg.adButton.width);

/**
 * The coins of the run: the coin tile (a button: its tap shows the breakdown by source in a
 * callout) and the "x2 for an ad" button of the level row. Call `update` every frame.
 */
export class ResultsCoins {
  readonly tile: StatTile;
  /** The "x2" button; null when the rules offer none. */
  readonly button: Button | null = null;
  private readonly buttonLabel: Phaser.GameObjects.Text | null = null;
  private readonly roll = new NumberRoll();
  private callout: Callout | null = null;
  private buttonEnabled = true;
  private busy = false;
  private adGone = false;
  /** The ad paid: the coins are doubled. */
  private doubled = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly earned: number,
    private readonly lines: readonly CoinLine[],
    /** False for a run that cannot be doubled (a dev run, the daily tower). */
    canDouble: boolean,
    tileWidth: number,
  ) {
    createTreasureTextures(scene);
    const icon = scene.add.image(0, 0, TREASURE_TEXTURES.coin);
    icon.setDisplaySize(cfg.tiles.iconSize, cfg.tiles.iconSize);
    this.tile = new StatTile(scene, {
      ...tileLook(tileWidth),
      icon,
      label: t('results.tile.coins'),
      onTap: () => this.toggleBreakdown(),
    });
    this.roll.set(0);
    this.roll.set(earned);
    const left = gameState.doublesLeft;
    if (canOfferDoubleCoins(earned, canDouble, left, gameState.runsFinished)) {
      const { button, label } = createTextButton(scene, {
        text: t('results.doubleLeft', { n: left }),
        font: cfg.adButton.font,
        maxLabelWidth: adRoom,
        fill: PALETTE.accentSecondary,
        layout: cfg.adButton,
        keyPrefix: 'ui_results_ad',
        onClick: () => void this.watchAd(),
      });
      this.buttonLabel = label;
      this.button = button;
      resetAdLabel(label, adRoom);
      watchAdState(button, (state) => this.followAd(state));
    }
    // The callout stands where the tile stood: a new screen size closes it rather than leave it behind.
    const closeCallout = (): void => this.callout?.close();
    scene.scale.on(Phaser.Scale.Events.RESIZE, closeCallout);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.scale.off(Phaser.Scale.Events.RESIZE, closeCallout);
      closeCallout();
    });
    this.update(0);
  }

  /** The screen is about to show: an ad that is not ready by now greys the button out. */
  refreshAd(): void {
    if (this.button && !this.adGone && !services.ads.isRewardedReady()) this.markAdGone();
  }

  /** The doubling ad is being shown or paid out. */
  get inProgress(): boolean {
    return this.busy;
  }

  /** The tile and the button are live only while the screen is in; going off closes the breakdown. */
  setEnabled(enabled: boolean): void {
    this.buttonEnabled = enabled;
    this.tile.setEnabled(enabled);
    if (!enabled) this.callout?.close();
    if (!this.busy && !this.adGone) this.button?.setEnabled(enabled);
  }

  update(dtMs: number): void {
    this.tile.setValue(formatNumber(this.roll.update(dtMs)));
  }

  /** Opens the breakdown under the tile, or closes it when it is open. */
  private toggleBreakdown(): void {
    if (this.callout?.isOpen) {
      this.callout.close();
      return;
    }
    const extra = this.doubled ? this.earned : 0;
    const breakdown = createBreakdown(this.scene, this.lines, this.earned + extra, extra);
    const callout = new Callout(this.scene, {
      lift: this.tile,
      width: cfg.breakdown.width,
      content: breakdown.content,
      contentHeight: breakdown.height,
      // A callout opened again during this one's fade keeps its ▲.
      onClosed: () => {
        if (this.callout === callout) this.tile.setOpen(false);
      },
    });
    this.callout = callout;
    this.tile.setOpen(true);
  }

  /**
   * The ad state changed while the screen shows: "Loading…" turns into the live button once the
   * ad has loaded, a ready ad that went away greys it out. Not while its ad shows or after it paid.
   */
  private followAd(state: AdState): boolean {
    if (state === 'busy' || this.busy || !this.button || !this.buttonLabel) return false;
    if (state !== 'ready') {
      this.markAdGone();
      return true;
    }
    this.adGone = false;
    this.buttonLabel.setText(t('results.doubleLeft', { n: gameState.doublesLeft }));
    resetAdLabel(this.buttonLabel, adRoom);
    this.button.setPlateAlpha(1);
    this.button.setEnabled(this.buttonEnabled);
    return true;
  }

  /** No ad can be shown: the button stays, inactive, saying so. */
  private markAdGone(): void {
    if (!this.button || !this.buttonLabel) return;
    this.adGone = true;
    markAdUnavailable(this.button, this.buttonLabel, adRoom, cfg.adDisabledAlpha);
  }

  /** The paid button gives way to a green "Doubled!" plate in its place that takes no taps. */
  private showDoubled(): void {
    const old = this.button;
    if (!old) return;
    const { button, label } = createTextButton(this.scene, {
      text: t('results.doubled'),
      font: cfg.adButton.font,
      maxLabelWidth: adRoom,
      fill: PALETTE.success,
      layout: cfg.adButton,
      keyPrefix: 'ui_results_doubled',
      onClick: () => {},
      x: old.x,
      y: old.y,
    });
    plainAdLabel(label, adRoom);
    button.setEnabled(false);
    old.parentContainer?.add(button);
    old.setVisible(false);
  }

  private async watchAd(): Promise<void> {
    if (this.busy || !this.button) return;
    this.busy = true;
    this.button.setEnabled(false);
    const result = await showRewarded('double_coins');
    if (!this.tile.active) return;
    if (result === 'rewarded') {
      if (!gameState.claimDoubleCoins(this.earned)) {
        // The daily limit ran out meanwhile: nothing was paid, so nothing is shown as doubled.
        this.markAdGone();
        return;
      }
      this.doubled = true;
      this.roll.set(this.earned * 2);
      this.showDoubled();
      services.audio.coin();
      return;
    }
    if (result === 'unavailable') {
      this.markAdGone();
      this.busy = false;
      return;
    }
    this.busy = false;
    this.button.setEnabled(this.buttonEnabled);
  }
}
