import { canOfferDoubleCoins } from '../../../../core/economy/video-policy';
import * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { formatNumber, t } from '../../../../i18n';
import { services } from '../../../../services';
import { gameState } from '../../../../state';
import { showRewarded } from '../../../economy/rewarded';
import { TREASURE_TEXTURES, createTreasureTextures } from '../../../fx/economy/treasure-textures';
import { createTextButton, type Button } from '../../common/button';
import { NumberRoll } from '../../common/number-roll';
import { createOutlinedText } from '../../common/outlined-text';
import {
  adLabelRoom,
  markAdUnavailable,
  plainAdLabel,
  resetAdLabel,
} from '../widgets/ad-unavailable';
import { fitText } from '../widgets/fit-text';
import { stackRows, type Row } from './results-layout';
import type { CoinLine } from './results-text';

const cfg = MENU.results;
const adRoom = adLabelRoom(cfg.adButton.width);

/**
 * The coins of the run: the total with a coin icon, the breakdown by source and the
 * "x2 for an ad" button. Add `container` to the screen; call `update` every frame.
 */
export class ResultsCoins {
  readonly container: Phaser.GameObjects.Container;
  /** Height of the block. */
  readonly height: number;
  private readonly total: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly roll = new NumberRoll();
  private readonly button: Button | null;
  private readonly buttonLabel: Phaser.GameObjects.Text | null = null;
  private buttonEnabled = true;
  private busy = false;
  private adGone = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly earned: number,
    lines: readonly CoinLine[],
    /** False for a run that did not reach the save (dev runs): its coins cannot be doubled. */
    canDouble: boolean,
  ) {
    createTreasureTextures(scene);
    this.container = scene.add.container(0, 0);
    this.total = createOutlinedText(scene, 0, 0, formatNumber(0), cfg.coinTotalFont, PALETTE.gold);
    const iconSize = cfg.coinTotalFont * cfg.coinIconScale;
    this.icon = scene.add.image(0, 0, TREASURE_TEXTURES.coin).setDisplaySize(iconSize, iconSize);
    const totalRow = scene.add.container(0, 0, [this.total, this.icon]);
    this.roll.set(0);
    this.roll.set(earned);

    const rows: Row[] = [{ obj: totalRow, height: cfg.coinTotalFont * cfg.lineHeight }];
    const grid = this.breakdown(lines);
    if (grid) rows.push(grid);
    this.button = null;
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
      rows.push({ obj: this.button, height: cfg.adButton.height });
    }
    this.height = stackRows(this.container, rows, cfg.rowGap);
    this.update(0);
  }

  /** The screen is about to show: an ad that is not ready by now greys the button out. */
  refreshAd(): void {
    if (this.button && !this.adGone && !services.ads.isRewardedReady()) this.markAdGone();
  }

  /** The button is live only while the screen is in. */
  setEnabled(enabled: boolean): void {
    this.buttonEnabled = enabled;
    if (!this.busy && !this.adGone) this.button?.setEnabled(enabled);
  }

  update(dtMs: number): void {
    const shown = this.roll.update(dtMs);
    this.total.setText(formatNumber(shown));
    const total = this.total.width + cfg.coinIconGap + this.icon.displayWidth;
    this.total.setX(-total / 2 + this.total.width / 2);
    this.icon.setX(total / 2 - this.icon.displayWidth / 2);
  }

  /** The breakdown: a grid of "Source +amount" lines, in columns. */
  private breakdown(lines: readonly CoinLine[]): Row | null {
    if (lines.length === 0) return null;
    const grid = this.scene.add.container(0, 0);
    const columns = cfg.breakdownColumns;
    const rowCount = Math.ceil(lines.length / columns);
    lines.forEach((line, i) => {
      const column = i % columns;
      const alone = i === lines.length - 1 && lines.length % columns === 1;
      const x = alone ? 0 : (column - (columns - 1) / 2) * cfg.breakdownColumnWidth;
      const text = createOutlinedText(
        this.scene,
        x,
        (Math.floor(i / columns) - (rowCount - 1) / 2) * cfg.breakdownRowHeight,
        `${t(`results.source.${line.source}`)} +${formatNumber(line.amount)}`,
        cfg.breakdownFont,
      );
      fitText(text, cfg.breakdownColumnWidth - cfg.adTextPadding / 2);
      grid.add(text);
    });
    return { obj: grid, height: rowCount * cfg.breakdownRowHeight };
  }

  /** No ad can be shown: the button stays, inactive, saying so. */
  private markAdGone(): void {
    if (!this.button || !this.buttonLabel) return;
    this.adGone = true;
    markAdUnavailable(this.button, this.buttonLabel, adRoom, cfg.adDisabledAlpha);
  }

  private async watchAd(): Promise<void> {
    if (this.busy || !this.button) return;
    this.busy = true;
    this.button.setEnabled(false);
    const result = await showRewarded('double_coins');
    if (!this.container.active) return;
    if (result === 'rewarded') {
      if (!gameState.claimDoubleCoins(this.earned)) {
        // The daily limit ran out meanwhile: nothing was paid, so nothing is shown as doubled.
        this.markAdGone();
        return;
      }
      this.roll.set(this.earned * 2);
      this.buttonLabel?.setText(t('results.doubled'));
      if (this.buttonLabel) plainAdLabel(this.buttonLabel, adRoom);
      services.audio.coin();
      return;
    }
    if (result === 'unavailable') {
      this.markAdGone();
      return;
    }
    this.busy = false;
    this.button.setEnabled(this.buttonEnabled);
  }
}
