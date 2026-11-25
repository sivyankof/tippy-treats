import type * as Phaser from 'phaser';
import type { RunResult } from '../../../../core/run/run-result';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { formatNumber, t } from '../../../../i18n';
import { gameState } from '../../../../state';
import { NumberRoll } from '../../common/number-roll';
import { createOutlinedText } from '../../common/outlined-text';
import { BalanceChip } from '../../style/balance-chip';
import { TitleRibbon } from '../../style/title-ribbon';
import { fitText } from '../widgets/fit-text';
import { stackRows, type Row } from './results-layout';
import type { LineTone, ResultsLine } from './results-lines';

const cfg = MENU.results;

const TONE_COLOR: Record<LineTone, number> = {
  record: PALETTE.accent,
  gold: PALETTE.gold,
  plain: PALETTE.textLight,
};

/**
 * "Tower height" on the kit's ribbon, the height rolling up big and the lines under it (the
 * record, the checkpoint start, the daily attempt, the layers to the record). A compact header
 * (short screen) has a smaller ribbon, height and lines.
 */
export class ResultsHeader {
  readonly container: Phaser.GameObjects.Container;
  /** Height of the block. */
  readonly height: number;
  private readonly roll = new NumberRoll();
  private readonly value: Phaser.GameObjects.Text;
  /** Row of the ribbon inside the container, for what stands beside it. */
  private readonly titleY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    result: RunResult,
    lines: readonly ResultsLine[],
    compact: boolean,
  ) {
    const look = compact ? cfg.header.compact : cfg.header;
    const ribbonScale = compact ? cfg.header.compact.ribbonScale : 1;
    this.container = scene.add.container(0, 0);
    const title = new TitleRibbon(scene, 0, 0, t('run.gameOver')).setScale(ribbonScale);
    this.value = createOutlinedText(scene, 0, 0, formatNumber(0), look.heightFont, PALETTE.gold);
    this.roll.set(0);
    this.roll.set(result.height);
    const rows: Row[] = [
      { obj: title, height: MENU.style.ribbon.height * ribbonScale },
      { obj: this.value, height: look.heightFont * cfg.header.heightLine },
    ];
    for (const line of lines) {
      const text = createOutlinedText(scene, 0, 0, line.text, look.lineFont, TONE_COLOR[line.tone]);
      text.setAlign('center');
      fitText(text, cfg.header.lineWidth);
      const count = line.text.split('\n').length;
      rows.push({ obj: text, height: look.lineFont * cfg.lineHeight * count });
    }
    this.height = stackRows(this.container, rows, cfg.rowGap);
    this.titleY = title.y;
  }

  /** A berry balance at the right end of the ribbon row; it moves with the header. */
  addBalance(): BalanceChip {
    const chip = new BalanceChip(this.scene, 'berries', cfg.frames.width / 2, this.titleY);
    chip.snap(gameState.berries);
    this.container.add(chip.root);
    return chip;
  }

  update(dtMs: number): void {
    this.value.setText(formatNumber(this.roll.update(dtMs)));
  }
}
