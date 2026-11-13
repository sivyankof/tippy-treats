import * as Phaser from 'phaser';
import { ABILITY_ANIM } from '../../../data/ability-anim';
import { ANIM } from '../../../data/anim';
import { oscillate01, TWO_PI } from '../../../util/math';
import { DEPTH } from '../../depth';
import { FX_TEXTURES } from '../fx-textures';
import { ABILITY_TEXTURES, COAT_SIZE } from './ability-textures';
import { fadeToward, isFadedIn } from './active-state';
import { hueColor } from './hue';

const cfg = ABILITY_ANIM.active;
/** What the flying layer is dressed in right now. */
export interface CoatState {
  frost: boolean;
  rainbow: boolean;
  glow: boolean;
}

/**
 * Overlays that follow the flying layer: an icy coat with crystals (frosty), a shifting rainbow
 * sheen (rainbow) and a glow when the ghost's guides say the throw would be perfect.
 */
export class FlyingCoat {
  private readonly frost: Phaser.GameObjects.Image;
  private readonly crystals: Phaser.GameObjects.Image[] = [];
  private readonly rainbow: Phaser.GameObjects.Image;
  private readonly glow: Phaser.GameObjects.Image;
  private frostFade = 0;
  private rainbowFade = 0;
  private glowFade = 0;

  constructor(scene: Phaser.Scene) {
    const coat = (): Phaser.GameObjects.Image =>
      scene.add.image(0, 0, ABILITY_TEXTURES.coat).setDepth(DEPTH.flyingCoat).setVisible(false);
    this.frost = coat().setTint(cfg.frosty.tint);
    this.rainbow = coat();
    this.glow = coat()
      .setTint(cfg.ghost.glowColor)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.flyingCoat + 1);
    const { crystalSlots, crystalAngleStep, crystalAngleWrap } = cfg.frosty;
    for (let i = 0; i < crystalSlots.length; i++) {
      this.crystals.push(
        scene.add
          .image(0, 0, FX_TEXTURES.spark)
          .setTint(cfg.frosty.crystalColor)
          .setDepth(DEPTH.flyingCoat + 1)
          .setAngle((i * crystalAngleStep) % crystalAngleWrap)
          .setVisible(false),
      );
    }
  }

  /** `pos` is the centre of the flying layer, `null` while none flies. */
  update(
    dtMs: number,
    timeMs: number,
    on: Readonly<CoatState>,
    pos: Readonly<{ x: number; y: number }> | null,
    width: number,
  ): void {
    const lerp = cfg.fadeLerp;
    this.frostFade = fadeToward(this.frostFade, on.frost && pos !== null, lerp, dtMs);
    this.rainbowFade = fadeToward(this.rainbowFade, on.rainbow && pos !== null, lerp, dtMs);
    this.glowFade = fadeToward(this.glowFade, on.glow && pos !== null, lerp, dtMs);
    const coatWidth = Math.max(1, width - ANIM.layer.outline * 2);
    const x = pos?.x ?? 0;
    const y = pos?.y ?? 0;

    this.placeCoat(this.frost, this.frostFade, x, y, coatWidth, cfg.frosty.coatAlpha);
    this.placeCrystals(timeMs, x, y, width);
    this.placeRainbow(timeMs, x, y, coatWidth);

    const pulse = oscillate01(timeMs, cfg.ghost.glowPeriodMs);
    const [minAlpha, maxAlpha] = cfg.ghost.glowAlpha;
    const grow = cfg.ghost.glowGrow;
    this.glow.setDisplaySize(coatWidth + grow * 2, COAT_SIZE.height + grow * 2);
    this.placeCoat(
      this.glow,
      this.glowFade,
      x,
      y,
      undefined,
      minAlpha + (maxAlpha - minAlpha) * pulse,
    );
  }

  private placeCoat(
    image: Phaser.GameObjects.Image,
    fade: number,
    x: number,
    y: number,
    width: number | undefined,
    alpha: number,
  ): void {
    const visible = isFadedIn(fade);
    image.setVisible(visible);
    if (!visible) return;
    image.setPosition(x, y).setAlpha(alpha * fade);
    if (width !== undefined) image.setDisplaySize(width, COAT_SIZE.height);
  }

  private placeCrystals(timeMs: number, x: number, y: number, width: number): void {
    const visible = isFadedIn(this.frostFade);
    const { crystalScale, crystalAlpha, crystalSlots, twinklePeriodMs } = cfg.frosty;
    const count = this.crystals.length;
    for (let i = 0; i < count; i++) {
      const crystal = this.crystals[i];
      if (!crystal) continue;
      crystal.setVisible(visible);
      if (!visible) continue;
      const slot = crystalSlots[i];
      const twinkle = oscillate01(timeMs, twinklePeriodMs, (i / count) * TWO_PI);
      crystal
        .setPosition(
          x + ((slot?.[0] ?? 0) * width) / 2,
          y + ((slot?.[1] ?? 0) * COAT_SIZE.height) / 2,
        )
        .setScale(crystalScale[0] + (crystalScale[1] - crystalScale[0]) * twinkle)
        .setAlpha(
          (crystalAlpha[0] + (crystalAlpha[1] - crystalAlpha[0]) * twinkle) * this.frostFade,
        );
    }
  }

  private placeRainbow(timeMs: number, x: number, y: number, coatWidth: number): void {
    const { coatAlpha, huePeriodMs, hueSpread, saturation } = cfg.rainbow;
    const visible = isFadedIn(this.rainbowFade);
    this.rainbow.setVisible(visible);
    if (!visible) return;
    const hue = timeMs / huePeriodMs;
    const left = hueColor(hue, saturation);
    const right = hueColor(hue + hueSpread, saturation);
    this.rainbow
      .setTint(left, right, left, right)
      .setPosition(x, y)
      .setDisplaySize(coatWidth, COAT_SIZE.height)
      .setAlpha(coatAlpha * this.rainbowFade);
  }
}
