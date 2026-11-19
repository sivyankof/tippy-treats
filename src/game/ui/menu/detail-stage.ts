import * as Phaser from 'phaser';
import type { CreatureId } from '../../../data/creatures/creatures';
import { MENU } from '../../../data/common/menu-layout';
import { PALETTE } from '../../../data/common/palette';
import { shade } from '../../../util/color';
import { hasNewLook, isMaster } from '../../../core/creatures/mastery';
import { CreaturePortrait } from '../../objects/creatures/creature-portrait';
import { bakeTexture } from '../common/bake-texture';
import { bakeMasteryFrame } from '../creatures/mastery-frame';
import { createIconButton } from './icon-button';
import { VolumePlate } from '../style/volume';
import { LevelStars } from './stars';

const cfg = MENU.detail;
const stage = cfg.stage;

/** A soft round glow of `color`, as concentric discs that fade outwards. */
function bakeGlow(scene: Phaser.Scene, key: string, color: number): void {
  const size = stage.glowRadius * 2;
  bakeTexture(scene, key, size, size, (g) => {
    for (let i = 0; i < stage.glowSteps; i++) {
      const share = 1 - i / stage.glowSteps;
      g.fillStyle(color, stage.glowAlpha / stage.glowSteps);
      g.fillCircle(stage.glowRadius, stage.glowRadius, stage.glowRadius * share);
    }
  });
}

/** A round stone the creature stands on: a dark base ring under a lighter top. */
function bakePedestal(scene: Phaser.Scene, key: string, color: number): void {
  const { width, height, rim } = stage.pedestal;
  bakeTexture(scene, key, width, height + rim, (g) => {
    g.fillStyle(shade(color, stage.pedestal.baseShade), 1);
    g.fillEllipse(width / 2, height / 2 + rim, width, height);
    g.fillStyle(color, 1);
    g.fillEllipse(width / 2, height / 2, width, height);
    g.fillStyle(PALETTE.panel, stage.pedestal.glossAlpha);
    g.fillEllipse(width / 2, height / 2 - height * 0.12, width * 0.7, height * 0.5);
  });
}

/**
 * The hero block of the creature card: a window plate with a rarity rim, a glow and a pedestal
 * behind the live creature, and the level stars on the lower edge. Centred on its position.
 */
export class DetailStage extends Phaser.GameObjects.Container {
  readonly portrait: CreaturePortrait;
  readonly stars: LevelStars | null;
  /** The gold frame of a level 5 creature, over the plate; `null` below that level. */
  readonly frame: Phaser.GameObjects.Image | null;

  constructor(
    scene: Phaser.Scene,
    id: CreatureId,
    level: number | null,
    rarityColor: number,
    width: number,
    /** Taps on the round "About" button; none for a locked creature. */
    onAbout: (() => void) | null = null,
  ) {
    super(scene, 0, 0);
    const plate = new VolumePlate(scene, 'window', stage.height, { rim: rarityColor });
    plate.setBodyWidth(width);
    const glowKey = `ui_detail_glow_${rarityColor.toString(16)}`;
    bakeGlow(scene, glowKey, rarityColor);
    const pedestalKey = `ui_detail_pedestal_${rarityColor.toString(16)}`;
    bakePedestal(scene, pedestalKey, shade(rarityColor, stage.pedestal.shade));
    const glow = scene.add.image(0, stage.portraitY, glowKey);
    const pedestal = scene.add
      .image(0, stage.pedestal.y, pedestalKey)
      .setOrigin(0.5, stage.pedestal.height / 2 / (stage.pedestal.height + stage.pedestal.rim));

    this.portrait = new CreaturePortrait(
      scene,
      0,
      stage.portraitY,
      id,
      level ?? 1,
      cfg.portraitWidth,
      1,
      level !== null && hasNewLook(level),
    );
    const lockedAlpha = level === null ? cfg.lockedAlpha : 1;
    this.portrait.setAlpha(lockedAlpha);
    const hit = new Phaser.Geom.Rectangle(
      0,
      0,
      cfg.portraitWidth,
      cfg.portraitWidth * cfg.portraitHit,
    );
    this.portrait
      .setSize(hit.width, hit.height)
      .setInteractive(hit, Phaser.Geom.Rectangle.Contains);
    this.portrait.on(Phaser.Input.Events.POINTER_DOWN, () => this.portrait.poke());

    this.stars =
      level === null ? null : new LevelStars(scene, 0, stage.starsY, level, cfg.starsScale);
    this.add([plate, glow, pedestal, this.portrait]);
    if (this.stars) this.add(this.stars);
    this.frame =
      level !== null && isMaster(level)
        ? scene.add.image(0, 0, bakeMasteryFrame(scene, { width, height: stage.height }))
        : null;
    if (this.frame) this.add(this.frame);
    if (onAbout) {
      const { size, inset } = cfg.about;
      this.add(
        createIconButton(
          scene,
          width / 2 - inset,
          -stage.height / 2 + inset,
          size,
          PALETTE.accentSecondary,
          'about',
          onAbout,
        ),
      );
    }
    scene.add.existing(this);
  }

  /** Where the creature stands, relative to the middle of the block. */
  get portraitOffsetY(): number {
    return stage.portraitY;
  }
}
