import * as Phaser from 'phaser';
import { OVEN_LOOK } from '../../../data/oven-look';
import { PALETTE } from '../../../data/palette';
import { zPose, type ZPose } from '../../objects/sleep-zs';
import { CREATURE_SLEEP } from '../../../data/creature-style';
import { effectsMode } from '../../effects-mode';
import {
  OVEN_PICTURE_HEIGHT,
  OVEN_TEXTURES,
  OVEN_WINDOW,
  bakeOvenTextures,
  type OvenState,
} from '../../fx/oven-texture';
import { createOutlinedText } from '../outlined-text';
import { FlameIcon } from './flame-icon';

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
 * Lit: bobs and rocks, the flame flickers. Spent: grey, breathes slowly, the ember glows, "z" float up.
 * Local (0, 0) is the middle of the body; `OVEN_PICTURE_HEIGHT` is its height at scale 1.
 */
export class OvenPicture extends Phaser.GameObjects.Container {
  private readonly holder: Phaser.GameObjects.Container;
  private readonly letters: Phaser.GameObjects.Text[] = [];
  private readonly pose: ZPose = { x: 0, y: 0, alpha: 0, scale: 0 };

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
    const body = scene.add.image(0, 0, bodyKey);
    const ring = scene.add.image(0, 0, lit ? t.ringLit : t.ringSpent);
    this.holder = scene.add.container(0, 0, [body]);
    if (lit) {
      const size = OVEN_WINDOW.radius * 2 * look.flame.size;
      this.holder.add(
        new FlameIcon(scene, 0, OVEN_WINDOW.y + OVEN_WINDOW.radius * look.flame.drop, size),
      );
    } else {
      this.holder.add(this.makeEmber(scene));
    }
    this.holder.add(ring);
    this.add(this.holder);
    if (!lit && options.letters) this.makeLetters(scene);
    scene.add.existing(this);
    this.startMotion(lit);
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.tweens.killTweensOf(this.holder));
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
    for (let i = 0; i < Z_COUNT; i++) {
      const letter = createOutlinedText(scene, 0, 0, CREATURE_SLEEP.zs.glyph, font, z.color);
      this.letters.push(letter);
      this.add(letter);
    }
    if (effectsMode.reduced) {
      this.placeLetters(0.5 * CREATURE_SLEEP.zs.periodMs, 1);
      return;
    }
    const period = CREATURE_SLEEP.zs.periodMs;
    scene.tweens.addCounter({
      from: 0,
      to: period,
      duration: period,
      repeat: -1,
      onUpdate: (tween) => {
        if (this.active) this.placeLetters(tween.getValue() ?? 0, Z_COUNT);
      },
    });
  }

  private placeLetters(timeMs: number, shown: number): void {
    const z = motion.zs;
    const h = OVEN_PICTURE_HEIGHT;
    this.letters.forEach((letter, i) => {
      const p = zPose(timeMs, i, this.pose);
      letter
        .setPosition(h * z.x + p.x * z.scale, h * z.y + p.y * z.scale)
        .setScale(p.scale * z.scale)
        .setAlpha(i < shown ? p.alpha : 0);
    });
  }

  private startMotion(lit: boolean): void {
    const scene = this.scene;
    if (lit) {
      const { rise, ms, stretch } = motion.bob;
      // A rotated picture inside a plate loses pieces of its image on Phaser 4 (docs/08 journal), so it hops and stretches instead of rocking.
      scene.tweens.add({
        targets: this.holder,
        y: -rise,
        scaleX: 1 - stretch,
        scaleY: 1 + stretch,
        duration: ms,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
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
