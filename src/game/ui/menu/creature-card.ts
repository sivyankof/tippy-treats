import * as Phaser from 'phaser';
import { unlockHint, unlockHints, type UnlockHint } from '../../../core/progression/collection';
import { hasNewLook } from '../../../core/creatures/mastery';
import { CREATURES, type CreatureId } from '../../../data/creatures/creatures';
import { MENU } from '../../../data/common/menu-layout';
import { PALETTE } from '../../../data/common/palette';
import { RARITY_COLORS } from '../../../data/creatures/rarity';
import { t } from '../../../i18n';
import { CreaturePortrait } from '../../objects/creatures/creature-portrait';
import { SleepingSilhouette } from '../../objects/creatures/sleep-silhouette';
import { createOutlinedText } from '../common/outlined-text';
import { fitText } from './fit-text';
import { VolumePlate } from '../style/volume';
import { shade } from '../../../util/color';
import { PriceTag } from './price-tag';
import { LevelStars } from './stars';
import { unlockText } from './unlock-text';

/** The numbers of a card: the team grid uses `MENU.card`, the collection its own sizes on top. */
export type CardLayout = { [K in keyof typeof MENU.card]: number };

/** What a card shows: an owned creature with its level, or a locked one. */
export interface CardState {
  id: CreatureId;
  /** Level of an owned creature; `null` when it is locked. */
  level: number | null;
  bakerLevel: number;
}

/**
 * A creature card of the collection and the team grid: a volumetric body with a rim in the colour of the rarity, the
 * live creature, its name and level stars. A locked creature is a sleeping muted silhouette with
 * the way to get it. (x, y) is the centre; the card is interactive over its whole size.
 */
export class CreatureCard extends Phaser.GameObjects.Container {
  readonly portrait: CreaturePortrait | null;
  private readonly silhouette: SleepingSilhouette | null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly card: CardState,
    cfg: CardLayout = MENU.card,
  ) {
    super(scene, x, y);
    const def = CREATURES[card.id];
    const owned = card.level !== null;
    const frame = owned ? RARITY_COLORS[def.rarity] : PALETTE.panelShadow;
    const fill = owned ? PALETTE.panel : shade(PALETTE.panel, cfg.lockedShade);
    this.add(
      new VolumePlate(scene, 'card', cfg.height, { fill, rim: frame }).setBodyWidth(cfg.width),
    );
    if (cfg.stageHeight > 0) {
      const stage = new VolumePlate(scene, 'chip', cfg.stageHeight, {
        fill: shade(frame, cfg.stageShade),
      });
      this.add(stage.setBodyWidth(cfg.width - cfg.stageInset * 2).setY(cfg.layerY));
    }
    if (owned) {
      this.portrait = new CreaturePortrait(
        scene,
        0,
        cfg.layerY,
        card.id,
        card.level ?? 1,
        cfg.layerWidth,
        cfg.layerScale,
        hasNewLook(card.level ?? 1),
      );
      this.silhouette = null;
      this.add(this.portrait);
      this.add(createOutlinedText(scene, 0, cfg.nameY, t(def.nameKey), cfg.nameFont));
      this.add(new LevelStars(scene, 0, cfg.starsY, card.level ?? 1, cfg.starsScale));
    } else {
      this.portrait = null;
      this.silhouette = new SleepingSilhouette(
        scene,
        0,
        cfg.layerY,
        card.id,
        cfg.layerWidth,
        cfg.layerScale,
        cfg.height / 2 + cfg.layerY - cfg.frame,
      );
      this.add(this.silhouette);
      this.add(this.createHint(card, cfg));
    }
    this.setSize(cfg.width, cfg.height);
    scene.add.existing(this);
  }

  /** The price of a creature the shop sells now, or the text of its way to get it. */
  private createHint(card: CardState, cfg: CardLayout): Phaser.GameObjects.GameObject {
    const hints = unlockHints(card.id);
    if (hints.length > 1) return this.createHintLines(hints, card, cfg);
    const hint = unlockHint(card.id);
    const text = unlockText(hint, card.bakerLevel);
    const y = (cfg.nameY + cfg.starsY) / 2;
    if (text === null && hint.kind === 'shop') {
      return new PriceTag(this.scene, 0, y, cfg.hintFont).show(
        '{price}',
        hint.price,
        hint.currency,
      );
    }
    return createOutlinedText(this.scene, 0, y, text ?? '', cfg.hintFont);
  }

  /** One small line per way to get the creature, the shop price with the level it needs among them. */
  private createHintLines(
    hints: UnlockHint[],
    card: CardState,
    cfg: CardLayout,
  ): Phaser.GameObjects.GameObject {
    const group = this.scene.add.container(0, (cfg.nameY + cfg.starsY) / 2);
    const maxWidth = cfg.width - cfg.hintPad * 2;
    hints.forEach((hint, i) => {
      const y = (i - (hints.length - 1) / 2) * cfg.hintLineGap;
      if (hint.kind === 'shop') {
        const template =
          card.bakerLevel >= hint.minBakerLevel
            ? '{price}'
            : t('unlock.shopFrom', { n: hint.minBakerLevel, price: '{price}' });
        const tag = new PriceTag(this.scene, 0, y, cfg.hintFontMulti).show(
          template,
          hint.price,
          hint.currency,
        );
        tag.setScale(Math.min(1, maxWidth / tag.contentWidth));
        group.add(tag);
        return;
      }
      const text = createOutlinedText(
        this.scene,
        0,
        y,
        unlockText(hint, card.bakerLevel) ?? '',
        cfg.hintFontMulti,
      );
      group.add(fitText(text, maxWidth));
    });
    return group;
  }

  tick(dtMs: number): void {
    this.portrait?.tick(dtMs);
    this.silhouette?.tick(dtMs);
  }
}
