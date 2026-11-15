import type * as Phaser from 'phaser';
import type { Currency } from '../../../core/economy';
import { DAILY } from '../../../data/daily';
import { MENU } from '../../../data/menu-layout';
import { REWARD_LOOK } from '../../../data/reward-look';
import { formatNumber, t } from '../../../i18n';
import { effectsMode } from '../../effects-mode';
import { REWARD_TEXTURES } from '../../fx/reward-pictures';
import { createOutlinedText } from '../outlined-text';
import { faceOffsetY, VolumePlate } from '../style/volume';
import { createCaption, type DailySection } from './daily-section';
import { PriceTag } from './price-tag';

const cfg = MENU.daily.rewards;
const captionHeight = MENU.daily.caption.height;
const CURRENCIES: readonly Currency[] = ['coins', 'berries'];

/** The reward bar: five tiers with their prizes; reached ones are green, a little muted and badged with a check, the best one has a gold rim, the next one to reach pulses softly. */
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
    const next = tiers.find((tier) => best < tier.height);
    const parts: Phaser.GameObjects.GameObject[] = [createCaption(scene, t('daily.rewards'), side)];
    tiers.forEach((tier, i) => {
      const x = -cfg.width / 2 + cellWidth / 2 + i * (cellWidth + cfg.gap);
      const y = captionHeight;
      const done = claimed.includes(tier.height);
      const tile: Phaser.GameObjects.GameObject[] = [
        new VolumePlate(scene, 'chip', cfg.cellHeight, {
          fill: done ? cfg.reachedFill : cfg.openFill,
          rim: top === tier ? cfg.bestRim : undefined,
        })
          .setBodyWidth(cellWidth)
          .setPosition(0, cfg.cellHeight / 2),
        createOutlinedText(scene, 0, cfg.heightY + lift, formatNumber(tier.height), cfg.heightFont),
      ];
      CURRENCIES.filter((currency) => (tier.reward[currency] ?? 0) > 0).forEach((currency, row) => {
        const rowY = cfg.priceFirstY + row * cfg.priceStep + lift;
        tile.push(
          new PriceTag(scene, 0, rowY, cfg.priceFont).show(
            '{price}',
            tier.reward[currency] ?? 0,
            currency,
          ),
        );
      });
      // A passed tier is a little muted, with the check badge on top of it.
      const holder = scene.add.container(x, y, tile).setAlpha(done ? cfg.doneAlpha : 1);
      parts.push(holder);
      if (done) {
        const size = cfg.tick.size;
        parts.push(
          scene.add
            .image(x + cellWidth / 2 - cfg.tick.inset, y + cfg.tick.inset, REWARD_TEXTURES.check)
            .setDisplaySize(size, size),
        );
      }
      if (tier === next && !done && !effectsMode.reduced) {
        const { scale, periodMs } = REWARD_LOOK.pulse;
        const tween = scene.tweens.add({
          targets: holder,
          scale,
          y: y - (cfg.cellHeight * (scale - 1)) / 2,
          duration: periodMs / 2,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        holder.once('destroy', () => tween.remove());
      }
    });
    this.root = scene.add.container(0, 0, parts);
  }
}
