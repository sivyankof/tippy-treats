import * as Phaser from 'phaser';
import { unlockHint } from '../../../core/collection';
import { CREATURES, type CreatureId } from '../../../data/creatures';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { RARITY_COLORS } from '../../../data/rarity';
import { t } from '../../../i18n';
import { CreaturePortrait } from '../../objects/creature-portrait';
import { bakeTexture } from '../bake-texture';
import { CREATURE_ICON_KEYS } from '../creature-icons';
import { createOutlinedText } from '../outlined-text';
import { drawFramedPanel } from './framed-panel';
import { PriceTag } from './price-tag';
import { LevelStars } from './stars';
import { unlockText } from './unlock-text';

const cfg = MENU.card;

/** The baked card face of a rarity (frame colour) or of a locked creature (grey frame). */
function cardTexture(scene: Phaser.Scene, frame: number): string {
  const key = `ui_card_${frame.toString(16)}`;
  bakeTexture(scene, key, cfg.width, cfg.height, (g) => {
    drawFramedPanel(g, 0, 0, cfg.width, cfg.height, {
      radius: cfg.radius,
      border: cfg.frame,
      borderColor: frame,
      fill: PALETTE.panel,
    });
  });
  return key;
}

/** What a card shows: an owned creature with its level, or a locked one. */
export interface CardState {
  id: CreatureId;
  /** Level of an owned creature; `null` when it is locked. */
  level: number | null;
  bakerLevel: number;
}

/**
 * A creature card of the collection and the team grid: a frame in the colour of the rarity, the
 * live creature, its name and level stars. A locked creature is a swaying dark silhouette with
 * the way to get it. (x, y) is the centre; the card is interactive over its whole size.
 */
export class CreatureCard extends Phaser.GameObjects.Container {
  readonly portrait: CreaturePortrait | null;
  private readonly silhouette: Phaser.GameObjects.Image | null;
  private timeMs = Math.random() * cfg.swayMs;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly card: CardState,
  ) {
    super(scene, x, y);
    const def = CREATURES[card.id];
    const owned = card.level !== null;
    const frame = owned ? RARITY_COLORS[def.rarity] : PALETTE.panelShadow;
    this.add(scene.add.image(0, 0, cardTexture(scene, frame)));
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
      this.add(new LevelStars(scene, 0, cfg.starsY, card.level ?? 1));
    } else {
      this.portrait = null;
      this.silhouette = scene.add
        .image(0, cfg.layerY, CREATURE_ICON_KEYS[card.id])
        .setDisplaySize(cfg.silhouetteSize, cfg.silhouetteSize)
        .setTint(cfg.silhouetteColor)
        .setTintMode(Phaser.TintModes.FILL)
        .setAlpha(cfg.silhouetteAlpha);
      this.add(this.silhouette);
      this.add(this.createHint(card));
    }
    this.setSize(cfg.width, cfg.height);
    scene.add.existing(this);
  }

  /** The price of a creature the shop sells now, or the text of its way to get it. */
  private createHint(card: CardState): Phaser.GameObjects.GameObject {
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
      const phase = (this.timeMs / cfg.swayMs) * Math.PI * 2;
      this.silhouette.setAngle(Math.sin(phase) * cfg.swayDeg);
    }
  }
}
