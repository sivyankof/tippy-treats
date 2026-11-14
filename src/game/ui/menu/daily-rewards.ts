import * as Phaser from 'phaser';
import type { Currency } from '../../../core/economy';
import { DAILY } from '../../../data/daily';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { formatNumber, t } from '../../../i18n';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { createCaption, type DailySection } from './daily-section';
import { PriceTag } from './price-tag';

const cfg = MENU.daily.rewards;
const captionHeight = MENU.daily.caption.height;
const CURRENCIES: readonly Currency[] = ['coins', 'berries'];

/** A green round tick with a white check mark, centred at (x, y). */
function drawTick(g: Phaser.GameObjects.Graphics, x: number, y: number, size: number): void {
  const r = size / 2;
  g.fillStyle(PALETTE.textDark, 1).fillCircle(x, y + r * 0.12, r);
  g.fillStyle(PALETTE.success, 1).fillCircle(x, y, r * 0.92);
  g.lineStyle(size * 0.14, PALETTE.textLight, 1);
  g.beginPath();
  g.moveTo(x - r * 0.45, y);
  g.lineTo(x - r * 0.1, y + r * 0.38);
  g.lineTo(x + r * 0.5, y - r * 0.38);
  g.strokePath();
}

/** The reward bar: five tiers with their prizes; reached ones are green and ticked, the best one has a gold rim. */
export class DailyRewards implements DailySection {
  readonly root: Phaser.GameObjects.Container;
  readonly height = captionHeight + cfg.cellHeight;

  constructor(scene: Phaser.Scene, best: number, claimed: readonly number[]) {
    const tiers = DAILY.tiers;
    const cellWidth = (cfg.width - (tiers.length - 1) * cfg.gap) / tiers.length;
    const lift = faceOffsetY('chip');
    const reached = tiers.filter((tier) => best >= tier.height);
    const top = reached[reached.length - 1];
    const side = best > 0 ? t('daily.best', { n: formatNumber(best) }) : t('daily.bestNone');
    const parts: Phaser.GameObjects.GameObject[] = [createCaption(scene, t('daily.rewards'), side)];
    tiers.forEach((tier, i) => {
      const x = -cfg.width / 2 + cellWidth / 2 + i * (cellWidth + cfg.gap);
      const y = captionHeight;
      const done = claimed.includes(tier.height);
      parts.push(
        new VolumePlate(scene, 'chip', cfg.cellHeight, {
          fill: done ? cfg.reachedFill : cfg.openFill,
          rim: top === tier ? cfg.bestRim : undefined,
        })
          .setBodyWidth(cellWidth)
          .setPosition(x, y + cfg.cellHeight / 2),
        createOutlinedText(
          scene,
          x,
          y + cfg.heightY + lift,
          formatNumber(tier.height),
          cfg.heightFont,
        ),
      );
      CURRENCIES.filter((currency) => (tier.reward[currency] ?? 0) > 0).forEach((currency, row) => {
        const rowY = y + cfg.priceFirstY + row * cfg.priceStep + lift;
        parts.push(
          new PriceTag(scene, x, rowY, cfg.priceFont).show(
            '{price}',
            tier.reward[currency] ?? 0,
            currency,
          ),
        );
      });
      if (done) {
        const g = scene.add.graphics();
        drawTick(g, x + cellWidth / 2 - cfg.tick.inset, y + cfg.tick.inset, cfg.tick.size);
        parts.push(g);
      }
    });
    this.root = scene.add.container(0, 0, parts);
  }
}
