import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t } from '../../../i18n';
import { services } from '../../../services';
import { gameState } from '../../../state';
import { TREASURE_TEXTURES, createTreasureTextures } from '../../fx/treasure-textures';
import { createTextButton, type Button } from '../button';
import { NumberRoll } from '../number-roll';
import { createOutlinedText } from '../outlined-text';
import { fitText } from './fit-text';
import { stackRows, type Row } from './results-layout';
import type { CoinLine } from './results-text';

const cfg = MENU.results;

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
    if (earned > 0 && canDouble) {
      const { button, label } = createTextButton(scene, {
        text: t('results.double'),
        font: cfg.adButton.font,
        maxLabelWidth: cfg.adButton.width - cfg.adTextPadding,
        fill: PALETTE.accentSecondary,
        layout: cfg.adButton,
        keyPrefix: 'ui_results_ad',
        onClick: () => void this.watchAd(),
      });
      this.buttonLabel = label;
      this.button = button;
      rows.push({ obj: this.button, height: cfg.adButton.height });
    }
    this.height = stackRows(this.container, rows, cfg.rowGap);
    this.update(0);
  }

  /** The button is live only while the screen is in. */
  setEnabled(enabled: boolean): void {
    this.buttonEnabled = enabled;
    if (!this.busy) this.button?.setEnabled(enabled);
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

  private async watchAd(): Promise<void> {
    if (this.busy || !this.button) return;
    this.busy = true;
    this.button.setEnabled(false);
    const result = await services.ads.showRewarded('double_coins');
    if (!this.container.active) return;
    if (result === 'rewarded') {
      gameState.addCoins(this.earned);
      gameState.countAdWatched();
      this.roll.set(this.earned * 2);
      this.buttonLabel?.setText(t('results.doubled'));
      if (this.buttonLabel) fitText(this.buttonLabel, cfg.adButton.width - cfg.adTextPadding);
      services.audio.coin();
      return;
    }
    if (result === 'unavailable') {
      const { x, y } = this.button;
      this.button.destroy();
      const note = createOutlinedText(
        this.scene,
        x,
        y,
        t('continue.adUnavailable'),
        cfg.adButton.font,
        cfg.unavailableColor,
      );
      fitText(note, cfg.adButton.width);
      this.container.add(note);
      return;
    }
    this.busy = false;
    this.button.setEnabled(this.buttonEnabled);
  }
}
