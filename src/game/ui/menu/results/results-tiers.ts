import type * as Phaser from 'phaser';
import type { DailyPayout } from '../../../../core/progression/daily';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { formatNumber, t, tn } from '../../../../i18n';
import { createOutlinedText } from '../../common/outlined-text';
import { fitText } from '../widgets/fit-text';
import { PriceTag } from '../widgets/price-tag';

const cfg = MENU.results.tiers;

/** Room kept for a reward tag at the right edge of a row. */
const TAG_SHARE = 0.4;

/**
 * The rows of Rewards that a run paid besides coins and XP: "Reward for height 30" with the
 * coins and berries at the right for each daily tier, and the first-time lap berries of a
 * Classic run ("New lap: +3 berries"). Each row is `MENU.results.tiers.rowHeight` tall and
 * `width` wide; (0, 0) is its middle.
 */
export function createTierRows(
  scene: Phaser.Scene,
  paid: readonly DailyPayout[],
  lapBerries: number,
  width: number,
): Phaser.GameObjects.Container[] {
  const rows = paid.map((tier) => {
    const row = scene.add.container(0, 0);
    const text = createOutlinedText(
      scene,
      -width / 2,
      0,
      t('resultsDaily.tier', { n: formatNumber(tier.height) }),
      cfg.font,
    ).setOrigin(0, 0.5);
    row.add(fitText(text, width * (1 - TAG_SHARE)));
    let right = width / 2;
    const parts: Array<['coins' | 'berries', number | undefined]> = [
      ['berries', tier.cost.berries],
      ['coins', tier.cost.coins],
    ];
    for (const [currency, amount] of parts) {
      if (!amount) continue;
      const tag = new PriceTag(scene, 0, 0, cfg.rewardFont, PALETTE.gold).show(
        '{price}',
        amount,
        currency,
      );
      tag.setX(right - tag.contentWidth / 2);
      right -= tag.contentWidth + cfg.rewardFont;
      row.add(tag);
    }
    return row;
  });
  if (lapBerries > 0) {
    const row = scene.add.container(0, 0);
    const text = createOutlinedText(scene, 0, 0, tn('resultsLap.reward', lapBerries), cfg.font);
    row.add(fitText(text, width));
    rows.push(row);
  }
  return rows;
}
