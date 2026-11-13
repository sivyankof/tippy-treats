import type * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { PALETTE } from '../../data/palette';
import { channels } from '../../util/color';

/** Anything a transition can slide and fade: texts, images, containers, buttons. */
export interface Movable {
  y: number;
  alpha: number;
  setY(y: number): unknown;
  setAlpha(alpha: number): unknown;
}

const { transition, popup } = ANIM.ui;
/** Screens go dark in the colour of the dim overlays. */
const DARK = channels(PALETTE.textDark);

/**
 * The elements of a new screen drop in from above one after another (`cascadeMs` apart)
 * and settle with a bounce. Call after the elements are laid out. `onDone` runs once the
 * last one has landed.
 */
export function enterScreen(
  scene: Phaser.Scene,
  items: readonly Movable[],
  onDone?: () => void,
): void {
  items.forEach((item, i) => {
    const y = item.y;
    item.setY(y - transition.distance);
    item.setAlpha(0);
    scene.tweens.add({
      targets: item,
      y,
      alpha: 1,
      duration: transition.inMs,
      ease: transition.inEase,
      delay: i * transition.cascadeMs,
      onComplete: i === items.length - 1 ? onDone : undefined,
    });
  });
  if (items.length === 0) onDone?.();
}

/**
 * The current screen leaves: `items` slide down while the scene's camera darkens
 * everything drawn up to this scene. `onDone` runs when the screen is dark.
 * Use the topmost visible scene, so the darkening covers the scenes below it.
 */
export function leaveScreen(
  scene: Phaser.Scene,
  items: readonly Movable[],
  onDone: () => void,
): void {
  for (const item of items) {
    scene.tweens.add({
      targets: item,
      y: item.y + transition.distance,
      duration: transition.outMs,
      ease: transition.outEase,
    });
  }
  scene.cameras.main.fadeOut(transition.outMs, ...DARK);
  scene.time.delayedCall(transition.outMs, onDone);
}

/** Extra camera scroll of a world that is dropping in; it settles to 0. */
export interface WorldEntry {
  offset: number;
}

/**
 * A scrolling world (the run) comes in: it lightens up from the dark of `leaveScreen`
 * and drops in from above. Add `offset` to the camera scroll every frame.
 */
export function enterWorld(scene: Phaser.Scene): WorldEntry {
  const entry: WorldEntry = { offset: transition.distance };
  scene.tweens.add({
    targets: entry,
    offset: 0,
    duration: transition.inMs,
    ease: transition.inEase,
  });
  scene.cameras.main.fadeIn(transition.inMs, ...DARK);
  return entry;
}

/** A popup window: the dim veil fades in and the window pops from small to full size. */
export function openPopup(
  scene: Phaser.Scene,
  dim: Movable,
  panel: { setScale(scale: number): unknown },
): void {
  dim.setAlpha(0);
  scene.tweens.add({ targets: dim, alpha: 1, duration: popup.dimMs });
  panel.setScale(popup.fromScale);
  scene.tweens.add({
    targets: panel,
    scale: 1,
    duration: popup.durationMs,
    ease: popup.ease,
  });
}
