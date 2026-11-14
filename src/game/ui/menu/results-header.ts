import type * as Phaser from 'phaser';
import type { RunResult } from '../../../core/run-result';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t } from '../../../i18n';
import { NumberRoll } from '../number-roll';
import { createOutlinedText } from '../outlined-text';
import { fitText } from './fit-text';
import { stackRows, type Row } from './results-layout';

const cfg = MENU.results;

/** "Tower height", the height rolling up big and, for a new best, the record label. */
export class ResultsHeader {
  readonly container: Phaser.GameObjects.Container;
  /** Height of the block. */
  readonly height: number;
  private readonly roll = new NumberRoll();
  private readonly value: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, result: RunResult, isRecord: boolean) {
    this.container = scene.add.container(0, 0);
    const title = createOutlinedText(scene, 0, 0, t('run.gameOver'), cfg.titleFont);
    this.value = createOutlinedText(scene, 0, 0, formatNumber(0), cfg.heightFont, PALETTE.gold);
    this.roll.set(0);
    this.roll.set(result.height);
    const rows: Row[] = [
      { obj: title, height: cfg.titleFont * cfg.lineHeight },
      { obj: this.value, height: cfg.heightFont * cfg.lineHeight },
    ];
    if (isRecord) {
      const record = createOutlinedText(
        scene,
        0,
        0,
        t('run.newRecord'),
        cfg.recordFont,
        PALETTE.accent,
      );
      rows.push({ obj: record, height: cfg.recordFont * cfg.lineHeight });
    }
    this.height = stackRows(this.container, rows, cfg.rowGap);
  }

  update(dtMs: number): void {
    this.value.setText(formatNumber(this.roll.update(dtMs)));
  }
}

/** Score, best combo and abilities of the run side by side, each with its caption. */
export function createStats(
  scene: Phaser.Scene,
  result: RunResult,
  abilities: number,
  width: number,
): { obj: Phaser.GameObjects.Container; height: number } {
  const cells = [
    { label: t('results.score'), value: formatNumber(result.score) },
    { label: t('results.bestCombo'), value: t('run.combo', { n: result.bestCombo }) },
    { label: t('results.abilities'), value: formatNumber(abilities) },
  ];
  const stats = scene.add.container(0, 0);
  const columnWidth = Math.min(cfg.statWidth, width / cells.length);
  const cellHeight = (cfg.labelFont + cfg.statFont) * cfg.lineHeight;
  cells.forEach((cell, i) => {
    const x = (i - (cells.length - 1) / 2) * columnWidth;
    const label = fitText(
      createOutlinedText(scene, x, -cellHeight / 2 + cfg.labelFont / 2, cell.label, cfg.labelFont),
      columnWidth - cfg.rowGap * 2,
    );
    const value = fitText(
      createOutlinedText(
        scene,
        x,
        cellHeight / 2 - cfg.statFont / 2,
        cell.value,
        cfg.statFont,
        PALETTE.gold,
      ),
      columnWidth - cfg.rowGap * 2,
    );
    stats.add([label, value]);
  });
  return { obj: stats, height: cellHeight };
}
