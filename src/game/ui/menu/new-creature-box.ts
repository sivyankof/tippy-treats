import * as Phaser from 'phaser';
import type { HopMotion } from '../../../data/hop-motion';
import { MENU } from '../../../data/menu-layout';
import {
  bakeGiftTextures,
  bodyKey,
  GIFT_BODY_ORIGIN,
  GIFT_LID_ORIGIN,
  GIFT_TEXTURES,
} from '../../fx/gift-texture';
import { runHop, startSwayTween } from './hop-motion';

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
    this.base = scene.add
      .image(0, -half + lidH + (cfg.boxSize - lidH) / 2, bodyKey(face, false))
      .setOrigin(GIFT_BODY_ORIGIN.x, GIFT_BODY_ORIGIN.y);
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
  startSway(motion: HopMotion, ready: boolean): void {
    this.stopSway();
    this.swayTween = startSwayTween(this.scene, this, motion, ready);
  }

  stopSway(): void {
    this.swayTween?.stop();
    this.swayTween = null;
    this.setAngle(0);
  }

  /** One hop: a crouch, a jump with a stretch, a fall and a squash on landing. Ignored while hopping. */
  hop(motion: HopMotion): void {
    if (this.hopping) return;
    this.hopping = true;
    runHop(this.scene, this, motion, () => (this.hopping = false));
  }
}
