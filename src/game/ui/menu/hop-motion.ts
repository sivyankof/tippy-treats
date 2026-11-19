import type * as Phaser from 'phaser';
import type { HopMotion } from '../../../data/common/hop-motion';

/** The target rocks `deg` degrees to each side, a full swing in `ms`, all the time. */
export function startSwayTween(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  deg: number,
  ms: number,
): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: target,
    angle: { from: -deg, to: deg },
    duration: ms / 2,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
}

/** One hop: a crouch, a jump with a stretch, a fall and a squash on landing. `onEnd` runs when it is over. */
export function runHop(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  motion: HopMotion,
  onEnd: () => void,
): void {
  const { rise, riseMs, fallMs, squash, stretch } = motion.hop;
  const sx = target.scaleX;
  const sy = target.scaleY;
  const y0 = target.y;
  const steps: Phaser.Types.Tweens.TweenBuilderConfig[] = [
    {
      targets: target,
      scaleX: sx * squash.x,
      scaleY: sy * squash.y,
      duration: squash.ms,
      ease: 'Sine.easeOut',
    },
    {
      targets: target,
      y: y0 - rise,
      scaleX: sx * stretch.x,
      scaleY: sy * stretch.y,
      duration: riseMs,
      ease: 'Quad.easeOut',
    },
    { targets: target, y: y0, scaleX: sx, scaleY: sy, duration: fallMs, ease: 'Quad.easeIn' },
    {
      targets: target,
      scaleX: sx * squash.x,
      scaleY: sy * squash.y,
      duration: squash.ms,
      yoyo: true,
      ease: 'Sine.easeOut',
    },
  ];
  const run = (i: number): void => {
    const step = steps[i];
    if (!step || !target.active) {
      onEnd();
      return;
    }
    scene.tweens.add({ ...step, onComplete: () => run(i + 1) });
  };
  run(0);
}

/** The sway and the hops of one container, with the bookkeeping both need (one sway at a time, no overlapping hops). */
export class HopSway {
  private swayTween: Phaser.Tweens.Tween | null = null;
  private hopping = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly target: Phaser.GameObjects.Container,
  ) {}

  /** Rocks from side to side all the time; `ready` rocks wider. Replaces a sway that runs. */
  startSway(motion: HopMotion, ready: boolean): void {
    this.stopSway();
    this.swayTween = startSwayTween(
      this.scene,
      this.target,
      ready ? motion.sway.readyDeg : motion.sway.idleDeg,
      motion.sway.ms,
    );
  }

  /** Stops the sway and stands the target upright. */
  stopSway(): void {
    this.swayTween?.stop();
    this.swayTween = null;
    this.target.setAngle(0);
  }

  /** One hop; ignored while one runs. */
  hop(motion: HopMotion): void {
    if (this.hopping || !this.target.active) return;
    this.hopping = true;
    runHop(this.scene, this.target, motion, () => (this.hopping = false));
  }
}
