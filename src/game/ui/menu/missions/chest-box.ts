import * as Phaser from 'phaser';
import type { ChestMotion } from '../../../../data/economy/chest-look';
import {
  CHEST_BODY_ORIGIN,
  CHEST_HINGE_Y,
  CHEST_INSIDE_ORIGIN,
  CHEST_LID_CLOSED_Y,
  CHEST_LID_ORIGIN,
  CHEST_TEXTURES,
  CHEST_TOP_Y,
  bakeChestTextures,
} from '../../../fx/economy/chest-texture';
import { CHEST_LOOK } from '../../../../data/economy/chest-look';
import { effectsMode } from '../../../effects-mode';
import { HopSway } from '../widgets/hop-motion';
import { LightRays } from '../new-creature/new-creature-rays';

export type ChestState = 'closed' | 'ready' | 'opened';

const RAYS_FULL_TURN_DEG = 360;
/** Local y of the middle of the whole chest picture, lid included: the rays turn around it. */
const PICTURE_CENTER_Y =
  (CHEST_LID_CLOSED_Y - CHEST_LOOK.size.lidHeight + CHEST_LOOK.size.bodyHeight / 2) / 2;

/** The chest of the day: a body, a domed lid that flips back on its hinge, and light rays while it is ready. */
export class ChestBox extends Phaser.GameObjects.Container {
  /** Local y of the top of the body: where the berries come out when the lid is open. */
  readonly openingY = CHEST_TOP_Y;
  private readonly trunk: Phaser.GameObjects.Image;
  private readonly lid: Phaser.GameObjects.Image;
  /** Holds the flattened, pulsing rays; only the rays inside it turn, so the squash stays level. */
  private rays: Phaser.GameObjects.Container | null = null;
  private raysInner: LightRays | null = null;
  private readonly sway: HopSway;
  private hopTimer: Phaser.Time.TimerEvent | null = null;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly motion: ChestMotion,
    state: ChestState,
  ) {
    super(scene, x, y);
    bakeChestTextures(scene);
    this.sway = new HopSway(scene, this);
    const open = state === 'opened';
    this.trunk = scene.add
      .image(0, 0, open ? CHEST_TEXTURES.bodyOpen : CHEST_TEXTURES.body)
      .setOrigin(CHEST_BODY_ORIGIN.x, CHEST_BODY_ORIGIN.y);
    this.lid = scene.add.image(0, 0, CHEST_TEXTURES.lid);
    this.add([this.lid, this.trunk]);
    if (open) this.showLidOpen();
    else this.showLidClosed();
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      this.stopAll();
      this.scene?.tweens.killTweensOf([this, this.lid]);
    });
    scene.add.existing(this);
    this.startMotion(state);
  }

  /** The lid shut, in front of the body. */
  private showLidClosed(): void {
    const o = CHEST_LID_ORIGIN;
    this.lid
      .setTexture(CHEST_TEXTURES.lid)
      .setOrigin(o.x, o.y)
      .setPosition(0, CHEST_LID_CLOSED_Y)
      .setScale(1);
    this.bringToTop(this.lid);
  }

  /** The lid thrown back: its inside stands behind the body on the hinge. */
  private showLidOpen(): void {
    const o = CHEST_INSIDE_ORIGIN;
    this.lid
      .setTexture(CHEST_TEXTURES.lidInside)
      .setOrigin(o.x, o.y)
      .setPosition(0, CHEST_HINGE_Y)
      .setScale(1);
    this.sendToBack(this.lid);
  }

  private startMotion(state: ChestState): void {
    const ready = state === 'ready';
    this.sway.startSway(this.motion, ready);
    if (!ready) return;
    this.hopTimer = this.scene.time.addEvent({
      delay: this.motion.hop.everyMs,
      loop: true,
      callback: () => this.sway.hop(this.motion),
    });
    if (!effectsMode.reduced) this.startRays();
  }

  private startRays(): void {
    const r = this.motion.rays;
    const inner = new LightRays(this.scene, CHEST_LOOK.colors.rays, r);
    // The rays start invisible; the holder carries the alpha pulse.
    inner.setAlpha(1);
    const burst = this.scene.add
      .graphics()
      .fillStyle(CHEST_LOOK.colors.burst, 1)
      .fillCircle(0, 0, r.burstRadius);
    const holder = this.scene.add.container(0, PICTURE_CENTER_Y, [burst, inner]);
    this.addAt(holder, 0);
    this.rays = holder;
    this.raysInner = inner;
    this.scene.tweens.add({
      targets: inner,
      angle: RAYS_FULL_TURN_DEG,
      duration: r.turnMs,
      repeat: -1,
    });
    holder.setScale(r.scale.from, r.scale.from * r.squashY).setAlpha(r.alpha.from);
    this.scene.tweens.add({
      targets: holder,
      scaleX: r.scale.to,
      scaleY: r.scale.to * r.squashY,
      alpha: r.alpha.to,
      duration: r.pulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** The lid flips back with a pop: it folds flat on its front edge, then stands up inside out behind the body. */
  playOpen(): void {
    this.stopAll();
    const { foldMs, popMs } = this.motion.open;
    this.setAngle(0);
    // Start from the shut chest: the box is built open, so put the closed picture back first.
    this.trunk.setTexture(CHEST_TEXTURES.body);
    this.showLidClosed();
    this.scene.tweens.add({
      targets: this.lid,
      scaleY: 0,
      duration: foldMs,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (!this.active) return;
        this.trunk.setTexture(CHEST_TEXTURES.bodyOpen);
        this.showLidOpen();
        this.lid.setScale(1, 0);
        this.scene.tweens.add({
          targets: this.lid,
          scaleY: 1,
          duration: popMs,
          ease: 'Back.easeOut',
        });
        this.startMotion('opened');
      },
    });
  }

  private stopAll(): void {
    this.sway.stopSway();
    this.hopTimer?.remove(false);
    this.hopTimer = null;
    if (this.rays && this.raysInner) {
      this.scene?.tweens.killTweensOf([this.rays, this.raysInner]);
      this.rays.destroy();
    }
    this.rays = null;
    this.raysInner = null;
  }
}
