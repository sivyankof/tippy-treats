import type * as Phaser from 'phaser';
import type { RunResult } from '../../../../core/run/run-result';
import { abilityCounts, type RunTally } from '../../../../core/run/run-tally';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { formatNumber, t } from '../../../../i18n';
import { gameState } from '../../../../state';
import { createCreatureIcon } from '../../creatures/creature-icons';
import { NumberRoll } from '../../common/number-roll';
import { createOutlinedText } from '../../common/outlined-text';
import { BalanceChip } from '../../style/balance-chip';
import { TitleRibbon } from '../../style/title-ribbon';
import { fitText, onFontRefresh } from '../widgets/fit-text';
import { cellWidths, stackRows, type Row } from './results-layout';

const cfg = MENU.results;

/** "Tower height" on the kit's ribbon, the height rolling up big and, for a new best, the record label. */
export class ResultsHeader {
  readonly container: Phaser.GameObjects.Container;
  /** Height of the block. */
  readonly height: number;
  private readonly roll = new NumberRoll();
  private readonly value: Phaser.GameObjects.Text;
  /** Row of the ribbon inside the container, for what stands beside it. */
  private readonly titleY: number;

  /** `startLine`: "Started at layer N, placed M" under the height of a run from a checkpoint. */
  constructor(
    private readonly scene: Phaser.Scene,
    result: RunResult,
    isRecord: boolean,
    startLine: string | null = null,
  ) {
    this.container = scene.add.container(0, 0);
    const title = new TitleRibbon(scene, 0, 0, t('run.gameOver'));
    this.value = createOutlinedText(scene, 0, 0, formatNumber(0), cfg.heightFont, PALETTE.gold);
    this.roll.set(0);
    this.roll.set(result.height);
    const rows: Row[] = [
      { obj: title, height: MENU.style.ribbon.height },
      { obj: this.value, height: cfg.heightFont * cfg.lineHeight },
    ];
    if (startLine) {
      const line = createOutlinedText(scene, 0, 0, startLine, cfg.startedFont);
      fitText(line, cfg.nearMissWidth);
      rows.push({ obj: line, height: cfg.startedFont * cfg.lineHeight });
    }
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
    this.titleY = title.y;
  }

  /** A berry balance at the right end of the ribbon row; it moves with the header. */
  addBalance(): BalanceChip {
    const chip = new BalanceChip(this.scene, 'berries', cfg.panel.width / 2, this.titleY);
    chip.snap(gameState.berries);
    this.container.add(chip.root);
    return chip;
  }

  update(dtMs: number): void {
    this.value.setText(formatNumber(this.roll.update(dtMs)));
  }
}

/** Score, best combo and the creatures whose abilities triggered side by side, each with its caption. */
export function createStats(
  scene: Phaser.Scene,
  result: RunResult,
  tally: RunTally,
  width: number,
): { obj: Phaser.GameObjects.Container; height: number } {
  const triggered = abilityCounts(tally);
  const cells: Array<{ label: string; value: string; wanted: number }> = [
    { label: t('results.score'), value: formatNumber(result.score), wanted: cfg.statWidth },
    {
      label: t('results.bestCombo'),
      value: t('run.combo', { n: result.bestCombo }),
      wanted: cfg.statWidth,
    },
  ];
  const widths = cellWidths(
    [...cells.map((c) => c.wanted), ...(triggered.length > 0 ? [cfg.abilityCellWidth] : [])],
    Math.max(0, Math.min(cfg.panel.width, width) - cfg.statEdgePad * 2),
  );
  const stats = scene.add.container(0, 0);
  const cellHeight = (cfg.labelFont + cfg.statFont) * cfg.lineHeight;
  const labelY = -cellHeight / 2 + cfg.labelFont / 2;
  const valueY = cellHeight / 2 - cfg.statFont / 2;
  let left = -widths.reduce((sum, w) => sum + w, 0) / 2;
  const addLabel = (text: string, x: number, columnWidth: number): void => {
    stats.add(
      fitText(
        createOutlinedText(scene, x, labelY, text, cfg.labelFont),
        columnWidth - cfg.rowGap * 2,
      ),
    );
  };
  cells.forEach((cell, i) => {
    const columnWidth = widths[i] ?? 0;
    const x = left + columnWidth / 2;
    left += columnWidth;
    addLabel(cell.label, x, columnWidth);
    stats.add(
      fitText(
        createOutlinedText(scene, x, valueY, cell.value, cfg.statFont, PALETTE.gold),
        columnWidth - cfg.rowGap * 2,
      ),
    );
  });
  if (triggered.length > 0) {
    const columnWidth = widths[cells.length] ?? 0;
    const x = left + columnWidth / 2;
    addLabel(t('results.abilities'), x, columnWidth);
    stats.add(abilityRow(scene, triggered, x, valueY, columnWidth - cfg.rowGap * 2));
  }
  return { obj: stats, height: cellHeight };
}

/** Small creature icons, each followed by how many times its ability triggered; the row is centred on (x, y). */
function abilityRow(
  scene: Phaser.Scene,
  triggered: ReturnType<typeof abilityCounts>,
  x: number,
  y: number,
  maxWidth: number,
): Phaser.GameObjects.Container {
  const row = scene.add.container(x, y);
  const items = triggered.map(({ id, count }) => {
    const icon = createCreatureIcon(scene, 0, 0, id).setDisplaySize(
      cfg.abilityIconSize,
      cfg.abilityIconSize,
    );
    const label = createOutlinedText(
      scene,
      0,
      0,
      t('results.abilityCount', { n: formatNumber(count) }),
      cfg.statFont * cfg.abilityCountScale,
      PALETTE.gold,
    ).setOrigin(0, 0.5);
    return { icon, label };
  });
  for (const { icon, label } of items) row.add([icon, label]);
  const layout = (): void => {
    const widths = items.map(({ label }) => cfg.abilityIconSize + cfg.abilityIconGap + label.width);
    const total = widths.reduce((sum, w) => sum + w, 0) + cfg.abilityItemGap * (items.length - 1);
    let left = -total / 2;
    items.forEach(({ icon, label }, i) => {
      icon.setPosition(left + cfg.abilityIconSize / 2, 0);
      label.setPosition(left + cfg.abilityIconSize + cfg.abilityIconGap, 0);
      left += (widths[i] ?? 0) + cfg.abilityItemGap;
    });
    row.setScale(total > maxWidth ? maxWidth / total : 1);
  };
  layout();
  onFontRefresh(row, layout);
  return row;
}
