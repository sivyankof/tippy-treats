import * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { CREATURE_SLEEP } from '../../data/creature-style';
import type { CreatureId } from '../../data/creatures';
import { shade } from '../../util/color';
import { bakeTexture } from '../ui/bake-texture';
import { createOutlinedText } from '../ui/outlined-text';
import { drawCreatureLayer } from './creature-art';
import { sleepLook } from './creature-art/sleep-look';
import { stroke } from './creature-art/primitives';
import { artRecipe } from '../../data/creature-looks';
import { artHeight, artOriginY, artTextureWidth, artTopPad, artWidth } from './layer-art';
import { eyeArcPoints, sleepEyes } from './sleep-eyes';
import { zPose, type ZPose } from './sleep-zs';

const { eyes: EYES, zs: ZS, breath: BREATH } = CREATURE_SLEEP;

/** Texture key of the sleeping silhouette of a creature on a layer of this width. */
export function sleepKey(id: CreatureId, layerWidth: number): string {
  return `sleep_${id}_${artWidth(layerWidth)}`;
}

/**
 * Bakes (once, the first time somebody asks) the sleeping silhouette: the creature's layer in
 * muted tones, the closed-eye arcs on it. The picture is laid out like the layer art, with the
 * centre of the layer body at `artOriginY(id)`. Returns the texture key.
 */
export function ensureSleepTexture(
  scene: Phaser.Scene,
  id: CreatureId,
  layerWidth: number,
): string {
  const key = sleepKey(id, layerWidth);
  const w = artWidth(layerWidth);
  const texW = artTextureWidth(w);
  const texH = artHeight(id);
  bakeTexture(scene, key, texW, texH, (g) => {
    g.translateCanvas(texW / 2, texH * artOriginY(id));
    drawCreatureLayer(g, id, w, null, true);
    const { outline } = sleepLook(id, artRecipe(id)).colors;
    for (const eye of sleepEyes(id, w)) {
      const points = eyeArcPoints(eye, EYES.steps);
      stroke(g, eye.thick, outline, 1, points);
      g.fillStyle(outline, 1);
      for (const end of [points[0], points[points.length - 1]]) {
        if (end) g.fillCircle(end[0], end[1], eye.thick / 2);
      }
    }
  });
  return key;
}

/**
 * A sleeping creature: its muted silhouette breathing slowly, with "z" letters floating up over
 * its head. (x, y) is the centre of the layer; `scale` sizes the whole thing. Call `tick`.
 */
export class SleepingSilhouette extends Phaser.GameObjects.Container {
  private readonly picture: Phaser.GameObjects.Image;
  private readonly letters: Phaser.GameObjects.Text[] = [];
  /** Holds the letters; public so a skipped reveal can stop its pop. */
  readonly lettersRoot: Phaser.GameObjects.Container;
  private readonly anchor: { x: number; y: number };
  private readonly pose: ZPose = { x: 0, y: 0, alpha: 0, scale: 0 };
  private timeMs = Math.random() * BREATH.periodMs;
  private readonly pictureScale: number;
  private readonly riseShare: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly creature: CreatureId,
    layerWidth: number,
    scale = 1,
    /** Room above the centre of the layer (in the parent's pixels) the letters must stay within; none by default. */
    headroom = Infinity,
  ) {
    super(scene, x, y);
    this.picture = scene.add
      .image(0, 0, ensureSleepTexture(scene, creature, layerWidth))
      .setOrigin(0.5, artOriginY(creature));
    const letterColor = shade(sleepLook(creature, artRecipe(creature)).colors.body, ZS.lighten);
    this.lettersRoot = scene.add.container(0, 0);
    ZS.sizeShares.forEach((share, i) => {
      if (i >= ZS.count) return;
      const letter = createOutlinedText(
        scene,
        0,
        0,
        ZS.glyph,
        ZS.font * share * scale,
        letterColor,
      );
      this.letters.push(letter);
      this.lettersRoot.add(letter);
    });
    // The first letter starts over the creature's top detail; the climb stops short of `headroom`.
    const anchorY = -(BALANCE.layer.height / 2 + artTopPad(creature) + ZS.anchorLift) * scale;
    const glyphHalf = ZS.font * scale * ZS.glyphHalfShare;
    this.riseShare = Math.max(
      ZS.minRiseShare,
      Math.min(1, (headroom + anchorY - glyphHalf) / (ZS.rise * scale)),
    );
    this.anchor = { x: ZS.anchorX * (artWidth(layerWidth) / 2) * scale, y: anchorY };
    this.pictureScale = scale;
    this.add([this.picture, this.lettersRoot]);
    this.placeLetters();
    scene.add.existing(this);
  }

  tick(dtMs: number): void {
    this.timeMs += dtMs;
    const breath = Math.sin((this.timeMs / BREATH.periodMs) * Math.PI * 2);
    this.picture.setScale(
      this.pictureScale * (1 - breath * BREATH.scaleX),
      this.pictureScale * (1 + breath * BREATH.scaleY),
    );
    this.placeLetters();
  }

  private placeLetters(): void {
    this.letters.forEach((letter, i) => {
      const pose = zPose(this.timeMs, i, this.pose);
      letter
        .setPosition(
          this.anchor.x + pose.x * this.pictureScale,
          this.anchor.y + pose.y * this.pictureScale * this.riseShare,
        )
        .setScale(pose.scale)
        .setAlpha(pose.alpha);
    });
  }

  /** The letters are shown (the loop runs) or hidden. */
  setLettersVisible(visible: boolean): this {
    this.lettersRoot.setVisible(visible).setScale(1).setAlpha(1);
    return this;
  }

  /** The letters pop out with a spring. */
  popLetters(): void {
    this.lettersRoot.setVisible(true).setScale(0).setAlpha(1);
    this.scene.tweens.add({
      targets: this.lettersRoot,
      scale: 1,
      duration: ZS.popMs,
      ease: ZS.popEase,
    });
  }

  override destroy(fromScene?: boolean): void {
    this.scene?.tweens.killTweensOf([this, this.lettersRoot]);
    super.destroy(fromScene);
  }
}
