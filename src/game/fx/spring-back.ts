import type * as Phaser from 'phaser';

/** The scale an animation starts from; an axis left out stays at 1. */
export type ScaleStart = { scaleX?: number; scaleY?: number };

/**
 * Sets the scale of `target` to `from` (after `delayMs`) and tweens it back to 1. Any running
 * tween of the target is stopped first, so a new squash always wins over the old one.
 */
export function springScaleBack(
  scene: Phaser.Scene,
  target: Phaser.GameObjects.Container,
  from: ScaleStart,
  durationMs: number,
  ease: string,
  delayMs: number,
): void {
  scene.tweens.killTweensOf(target);
  const props: Record<string, { from: number; to: number }> = {};
  for (const key of ['scaleX', 'scaleY'] as const) {
    const start = from[key];
    if (start !== undefined) props[key] = { from: start, to: 1 };
  }
  if (delayMs <= 0) target.setScale(from.scaleX ?? 1, from.scaleY ?? 1);
  else target.setScale(1);
  scene.tweens.add({
    targets: target,
    ...props,
    duration: durationMs,
    ease,
    delay: delayMs,
  });
}
