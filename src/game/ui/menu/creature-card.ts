import * as Phaser from 'phaser';
import { unlockHint } from '../../../core/collection';
import { CREATURES, type CreatureId } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { RARITY_COLORS } from '../../../data/rarity';
import { t } from '../../../i18n';
import { CreaturePortrait } from '../../objects/creature-portrait';
import { CREATURE_ICON_KEYS } from '../creature-icons';
import { createOutlinedText } from '../outlined-text';
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
 * live creature, its name and level stars. A locked creature is a swaying dark silhouette with
 * the way to get it. (x, y) is the centre; the card is interactive over its whole size.
 */
export class CreatureCard extends Phaser.GameObjects.Container {
  readonly portrait: CreaturePortrait | null;
  private readonly silhouette: Phaser.GameObjects.Image | null;
  private timeMs = Math.random() * MENU.card.swayMs;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly card: CardState,
    private readonly cfg: CardLayout = MENU.card,
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
      );
      this.silhouette = null;
      this.add(this.portrait);
      this.add(createOutlinedText(scene, 0, cfg.nameY, t(def.nameKey), cfg.nameFont));
      this.add(new LevelStars(scene, 0, cfg.starsY, card.level ?? 1, cfg.starsScale));
    } else {
      this.portrait = null;
      this.silhouette = scene.add
        .image(0, cfg.layerY, CREATURE_ICON_KEYS[card.id])
        .setDisplaySize(cfg.silhouetteSize, cfg.silhouetteSize)
        .setTint(cfg.silhouetteColor)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(cfg.silhouetteAlpha);
      this.add(this.silhouette);
      this.add(this.createHint(card, cfg));
    }
    this.setSize(cfg.width, cfg.height);
    scene.add.existing(this);
  }

  /** The price of a creature the shop sells now, or the text of its way to get it. */
  private createHint(card: CardState, cfg: CardLayout): Phaser.GameObjects.GameObject {
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

  tick(dtMs: number): void {
    this.timeMs += dtMs;
    this.portrait?.tick(dtMs);
    if (this.silhouette) {
      const phase = (this.timeMs / MENU.card.swayMs) * Math.PI * 2;
      this.silhouette.setY(this.cfg.layerY + Math.sin(phase) * MENU.card.bobPx);
    }
  }
}
