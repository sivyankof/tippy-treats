import type * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { formatNumber, t } from '../../../../i18n';
import { createOutlinedText } from '../../common/outlined-text';
import { fitText } from '../widgets/fit-text';
import type { CoinLine } from './results-text';

const cfg = MENU.results.breakdown;
const CALLOUT = MENU.style.callout;
const COLUMNS = 2;

/**
 * The coin breakdown of the callout: "Source +amount" in two columns (after an ad that doubled
 * the coins, "Doubled +N" last), a dashed line and "Total N". The content's (0, 0) is its top-centre; `height` is what it takes.
 */
export function createBreakdown(
  scene: Phaser.Scene,
  lines: readonly CoinLine[],
  total: number,
  /** Coins the ad added (0 when the coins were not doubled). */
  doubled = 0,
): { content: Phaser.GameObjects.Container; height: number } {
  const content = scene.add.container(0, 0);
  const inner = cfg.width - CALLOUT.padX * 2;
  const column = (inner - cfg.columnGap) / COLUMNS;
  const texts = lines.map(
    (line) => `${t(`results.source.${line.source}`)} +${formatNumber(line.amount)}`,
  );
  if (doubled > 0) texts.push(t('results.doubledLine', { n: formatNumber(doubled) }));
  const rows = Math.ceil(texts.length / COLUMNS);
  texts.forEach((label, i) => {
    const left = -inner / 2 + (i % COLUMNS) * (column + cfg.columnGap);
    const y = Math.floor(i / COLUMNS) * cfg.rowHeight + cfg.rowHeight / 2;
    const text = createOutlinedText(scene, left, y, label, cfg.font).setOrigin(0, 0.5);
    content.add(fitText(text, column));
  });
  let y = rows * cfg.rowHeight + cfg.totalGap;
  // A dashed line across the hint, drawn once when it opens.
  const { dash } = cfg;
  const g = scene.add.graphics();
  g.fillStyle(dash.color, 1);
  for (let x = -inner / 2; x < inner / 2; x += dash.width + dash.gap) {
    g.fillRect(x, y, Math.min(dash.width, inner / 2 - x), dash.thickness);
  }
  content.add(g);
  y += dash.thickness + cfg.totalGap / 2;
  const totalHeight = cfg.totalFont * MENU.results.lineHeight;
  const totalText = createOutlinedText(
    scene,
    0,
    y + totalHeight / 2,
    t('results.total', { n: formatNumber(total) }),
    cfg.totalFont,
    PALETTE.gold,
  );
  content.add(fitText(totalText, inner));
  return { content, height: y + totalHeight };
}
