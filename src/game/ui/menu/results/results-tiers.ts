import type * as Phaser from 'phaser';
import type { DailyPayout } from '../../../../core/progression/daily';
import { MENU } from '../../../../data/common/menu-layout';
import { formatNumber, t, tn } from '../../../../i18n';
import { createOutlinedText } from '../../common/outlined-text';
import { fitText } from '../widgets/fit-text';
import { PriceTag } from '../widgets/price-tag';
import { stackRows, type Row } from './results-layout';

const cfg = MENU.results.tiers;

/** Room kept for a reward tag at the right edge of a row. */
const TAG_SHARE = 0.4;

/**
 * The daily tiers a daily run paid: "Daily reward for 30 layers" with the coins and berries at
 * the right, one compact row each, and the first-time lap berries of a Classic run ("New lap:
 * +3 berries"). `height` is 0 when the run paid nothing.
 */
export class ResultsTiers {
  readonly container: Phaser.GameObjects.Container;
  readonly height: number;

  constructor(scene: Phaser.Scene, paid: readonly DailyPayout[], lapBerries = 0) {
    this.container = scene.add.container(0, 0);
    const rows: Row[] = paid.map((tier) => {
      const row = scene.add.container(0, 0);
      const text = createOutlinedText(
        scene,
        -cfg.width / 2,
        0,
        t('resultsDaily.tier', { n: formatNumber(tier.height) }),
        cfg.font,
      ).setOrigin(0, 0.5);
      row.add(fitText(text, cfg.width * (1 - TAG_SHARE)));
      let right = cfg.width / 2;
      const parts: Array<['coins' | 'berries', number | undefined]> = [
        ['berries', tier.cost.berries],
        ['coins', tier.cost.coins],
      ];
      for (const [currency, amount] of parts) {
        if (!amount) continue;
        const tag = new PriceTag(scene, 0, 0, cfg.rewardFont).show('{price}', amount, currency);
        tag.setX(right - tag.contentWidth / 2);
        right -= tag.contentWidth + cfg.rewardFont;
        row.add(tag);
      }
      return { obj: row, height: cfg.rowHeight };
    });
    if (lapBerries > 0) {
      const row = scene.add.container(0, 0);
      const text = createOutlinedText(
        scene,
        0,
        0,
        tn('resultsLap.reward', lapBerries),
        cfg.font,
      ).setOrigin(0.5);
      row.add(fitText(text, cfg.width));
      rows.push({ obj: row, height: cfg.rowHeight });
    }
    this.height = rows.length === 0 ? 0 : stackRows(this.container, rows, cfg.rowGap);
    this.container.setVisible(rows.length > 0);
  }
}
