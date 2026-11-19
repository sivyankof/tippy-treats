import * as Phaser from 'phaser';
import { BALANCE } from '../../data/tower/balance';
import { CREATURE_SLEEP } from '../../data/creatures/creature-style';
import type { CreatureId } from '../../data/creatures/creatures';
import { shade } from '../../util/color';
import { bakeTexture } from '../ui/bake-texture';
import { drawCreatureLayer } from './creature-art';
import { sleepLook } from './creature-art/sleep-look';
import { stroke } from './creature-art/primitives';
import { artRecipe } from '../../data/creatures/creature-looks';
import { artHeight, artOriginY, artTextureWidth, artTopPad, artWidth } from './layer-art';
import { eyeArcPoints, sleepEyes } from './sleep-eyes';
import { SleepLetters } from './sleep-letters';

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
  private readonly letters: SleepLetters;
  /** Holds the letters; public so a skipped reveal can stop its pop. */
  readonly lettersRoot: Phaser.GameObjects.Container;
  private readonly anchor: { x: number; y: number };
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
    this.letters = new SleepLetters(
      scene,
      this.lettersRoot,
      ZS.sizeShares.slice(0, ZS.count).map((share) => ZS.font * share * scale),
      letterColor,
      this.timeMs,
    );
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
    this.letters.setTime(this.timeMs);
    this.letters.place({
      x: this.anchor.x,
      y: this.anchor.y,
      reachX: this.pictureScale,
      reachY: this.pictureScale * this.riseShare,
      scale: 1,
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
