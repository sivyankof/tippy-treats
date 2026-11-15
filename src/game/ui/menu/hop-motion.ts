import type * as Phaser from 'phaser';
import type { HopMotion } from '../../../data/hop-motion';

/** The target rocks from side to side all the time; `ready` rocks wider. */
export function startSwayTween(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  motion: HopMotion,
  ready: boolean,
): Phaser.Tweens.Tween {
  const deg = ready ? motion.sway.readyDeg : motion.sway.idleDeg;
  return scene.tweens.add({
    targets: target,
    angle: { from: -deg, to: deg },
    duration: motion.sway.ms / 2,
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
