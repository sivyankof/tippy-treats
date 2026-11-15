import * as Phaser from 'phaser';
import { OVEN_LOOK } from '../../../data/oven-look';
import { PALETTE } from '../../../data/palette';
import { SleepLetters } from '../../objects/sleep-letters';
import { CREATURE_SLEEP } from '../../../data/creature-style';
import { effectsMode } from '../../effects-mode';
import {
  OVEN_ORIGIN,
  OVEN_PICTURE_HEIGHT,
  OVEN_TEXTURES,
  OVEN_WINDOW,
  bakeOvenTextures,
  type OvenState,
} from '../../fx/oven-texture';
import { FlameIcon } from './flame-icon';
import { startSwayTween } from './hop-motion';

const look = OVEN_LOOK;
const motion = look.motion;
const Z_COUNT = CREATURE_SLEEP.zs.count;

export interface OvenPictureOptions {
  state: OvenState;
  /** Eyes and a smile on the body; small icons have none. */
  face: boolean;
  /** Draws the sleeping letters of a spent oven; false for an icon. */
  letters?: boolean;
}

/**
 * The oven character: body, a flame (or a tiny ember) behind the ring of the window, a face.
 * Lit: rocks gently, the flame flickers. Spent: grey, breathes slowly, the ember glows, "z" float up.
 * Local (0, 0) is the middle of the body; `OVEN_PICTURE_HEIGHT` is its height at scale 1.
 */
export class OvenPicture extends Phaser.GameObjects.Container {
  private readonly holder: Phaser.GameObjects.Container;
  private letters: SleepLetters | null = null;
  private ember: Phaser.GameObjects.Graphics | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, options: OvenPictureOptions) {
    super(scene, x, y);
    bakeOvenTextures(scene);
    const lit = options.state === 'lit';
    const t = OVEN_TEXTURES;
    const bodyKey = lit
      ? options.face
        ? t.litFace
        : t.litPlain
      : options.face
        ? t.spentFace
        : t.spentPlain;
    const body = scene.add.image(0, 0, bodyKey).setOrigin(OVEN_ORIGIN.x, OVEN_ORIGIN.y);
    const ring = scene.add
      .image(0, 0, lit ? t.ringLit : t.ringSpent)
      .setOrigin(OVEN_ORIGIN.x, OVEN_ORIGIN.y);
    this.holder = scene.add.container(0, 0, [body]);
    if (lit) {
      const size = OVEN_WINDOW.radius * 2 * look.flame.size;
      const flame = new FlameIcon(
        scene,
        0,
        OVEN_WINDOW.y + OVEN_WINDOW.radius * look.flame.drop,
        size,
      );
      this.holder.add(flame);
    } else {
      this.ember = this.makeEmber(scene);
      this.holder.add(this.ember);
    }
    this.holder.add(ring);
    this.add(this.holder);
    if (!lit && options.letters) this.makeLetters(scene);
    scene.add.existing(this);
    this.startMotion(lit);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      const targets = [this.holder, this.ember].filter((o) => o !== null);
      scene.tweens.killTweensOf(targets);
    });
  }

  private makeEmber(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
    const r = OVEN_WINDOW.radius * look.ember.radius;
    const g = scene.add.graphics();
    const y = OVEN_WINDOW.y + OVEN_WINDOW.radius * look.ember.drop;
    g.fillStyle(look.ember.color, 1).fillCircle(0, y, r);
    g.fillStyle(look.ember.core, 1).fillCircle(0, y, r * 0.5);
    if (!effectsMode.reduced) {
      scene.tweens.add({
        targets: g,
        alpha: look.motion.emberPulse.alpha,
        duration: look.motion.emberPulse.ms,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    return g;
  }

  private makeLetters(scene: Phaser.Scene): void {
    const z = motion.zs;
    const font = OVEN_PICTURE_HEIGHT * z.font;
    this.letters = new SleepLetters(
      scene,
      this,
      Array.from({ length: Z_COUNT }, () => font),
      z.color,
      effectsMode.reduced ? 0.5 * CREATURE_SLEEP.zs.periodMs : 0,
    );
    this.placeLetters();
  }

  /** The sleeping letters float on the scene's update list; "fewer effects" leaves one still frame. */
  preUpdate(_time: number, delta: number): void {
    if (!this.letters || effectsMode.reduced) return;
    this.letters.tick(delta);
    this.placeLetters();
  }

  private placeLetters(): void {
    const z = motion.zs;
    const h = OVEN_PICTURE_HEIGHT;
    this.letters?.place({
      x: h * z.x,
      y: h * z.y,
      reachX: z.scale,
      reachY: z.scale,
      scale: z.scale,
      shown: effectsMode.reduced ? 1 : Z_COUNT,
    });
  }

  private startMotion(lit: boolean): void {
    const scene = this.scene;
    if (lit) {
      startSwayTween(scene, this.holder, motion.sway, false);
      return;
    }
    const { scaleX, scaleY, ms } = motion.breath;
    this.holder.setScale(1, 1);
    scene.tweens.add({
      targets: this.holder,
      scaleX: 1 + scaleX,
      scaleY: 1 + scaleY,
      duration: ms,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

/** Colour of the "×N" line: gold while the oven is lit, a muted tone when it sleeps. */
export const OVEN_TEXT_COLOR = { lit: PALETTE.gold, spent: 0xb9b2c6 } as const;
