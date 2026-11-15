import * as Phaser from 'phaser';
import type { GiftMotion } from '../../../data/gift-look';
import { MENU } from '../../../data/menu-layout';
import { bakeGiftTextures, bodyKey, GIFT_LID_ORIGIN, GIFT_TEXTURES } from '../../fx/gift-texture';

const cfg = MENU.newCreature;

export interface GiftBoxOptions {
  /** The small face on the body; only the large box has one. */
  face?: boolean;
}

/** The gift box in the manner of the plain layers: a body, and a lid with a bow that can fly off. */
export class GiftBox extends Phaser.GameObjects.Container {
  readonly base: Phaser.GameObjects.Image;
  readonly lid: Phaser.GameObjects.Image;
  /** Local y of the top of the body: where things pour out when the lid is off. */
  readonly openingY: number;
  private swayTween: Phaser.Tweens.Tween | null = null;
  private hopping = false;
  private readonly face: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number, options: GiftBoxOptions = {}) {
    super(scene, x, y);
    const face = options.face ?? false;
    this.face = face;
    bakeGiftTextures(scene, face);
    const half = cfg.boxSize / 2;
    const lidH = cfg.lidHeight;
    this.openingY = -half + lidH;
    // The body picture is centred on the body, the lid picture pivots around the middle of the lid.
    this.base = scene.add.image(0, -half + lidH + (cfg.boxSize - lidH) / 2, bodyKey(face, false));
    this.lid = scene.add
      .image(0, -half + lidH / 2, GIFT_TEXTURES.lid)
      .setOrigin(GIFT_LID_ORIGIN.x, GIFT_LID_ORIGIN.y);
    this.add([this.base, this.lid]);
    this.once(Phaser.GameObjects.Events.DESTROY, () => this.scene?.tweens.killTweensOf(this));
    scene.add.existing(this);
  }

  /** The lid flies up and away; the body stays. Calls `onDone` when the lid is gone. */
  popLid(onDone?: () => void): void {
    const f = cfg.lidFlight;
    // The lid leaves, so the body shows its opening.
    this.base.setTexture(bodyKey(this.face, true));
    this.scene.tweens.add({
      targets: this.lid,
      y: this.lid.y - f.rise,
      x: f.drift,
      angle: f.spinDeg,
      alpha: 0,
      duration: f.ms,
      ease: 'Quad.easeOut',
      onComplete: onDone,
    });
  }

  /** The box rocks from side to side all the time; `ready` rocks wider. */
  startSway(motion: GiftMotion, ready: boolean): void {
    this.stopSway();
    const deg = ready ? motion.sway.readyDeg : motion.sway.idleDeg;
    this.swayTween = this.scene.tweens.add({
      targets: this,
      angle: { from: -deg, to: deg },
      duration: motion.sway.ms / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  stopSway(): void {
    this.swayTween?.stop();
    this.swayTween = null;
    this.setAngle(0);
  }

  /** One hop: a crouch, a jump with a stretch, a fall and a squash on landing. Ignored while hopping. */
  hop(motion: GiftMotion): void {
    if (this.hopping) return;
    this.hopping = true;
    const { rise, riseMs, fallMs, squash, stretch } = motion.hop;
    const sx = this.scaleX;
    const sy = this.scaleY;
    const y0 = this.y;
    const steps: Phaser.Types.Tweens.TweenBuilderConfig[] = [
      {
        targets: this,
        scaleX: sx * squash.x,
        scaleY: sy * squash.y,
        duration: squash.ms,
        ease: 'Sine.easeOut',
      },
      {
        targets: this,
        y: y0 - rise,
        scaleX: sx * stretch.x,
        scaleY: sy * stretch.y,
        duration: riseMs,
        ease: 'Quad.easeOut',
      },
      { targets: this, y: y0, scaleX: sx, scaleY: sy, duration: fallMs, ease: 'Quad.easeIn' },
      {
        targets: this,
        scaleX: sx * squash.x,
        scaleY: sy * squash.y,
        duration: squash.ms,
        yoyo: true,
        ease: 'Sine.easeOut',
      },
    ];
    const run = (i: number): void => {
      const step = steps[i];
      if (!step || !this.active) {
        this.hopping = false;
        return;
      }
      this.scene.tweens.add({ ...step, onComplete: () => run(i + 1) });
    };
    run(0);
  }
}
