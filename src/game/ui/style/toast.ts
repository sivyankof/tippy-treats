import type * as Phaser from 'phaser';
import { PALETTE } from '../../../data/common/palette';
import { MENU } from '../../../data/common/menu-layout';
import { fitText } from '../menu/widgets/fit-text';
import { createOutlinedText } from '../common/outlined-text';
import { safeFrame } from '../common/safe-frame';
import { createPlate } from './volume';
import { pinToCanvas } from '../common/pin-canvas';

const cfg = MENU.style.toast;

/** Where a notice stands for the tapped `button`: its centre on the canvas, clamped to the screen sides. */
function spotOnButton(
  scene: Phaser.Scene,
  button: Phaser.GameObjects.Container,
  screenWidth: number,
): { x: number; y: number } {
  const cam = scene.cameras.main;
  const m = button.getWorldTransformMatrix();
  const half = cfg.width / 2 + cfg.onButton.margin;
  const x = Math.min(Math.max(m.tx - cam.scrollX, half), screenWidth - half);
  const y = m.ty - cam.scrollY;
  // A button narrower than the plate would leave its neighbours under the plate: the plate goes above it.
  if (button.width >= cfg.width) return { x, y };
  return {
    x,
    y: y - button.height / 2 - cfg.onButton.gap - Math.min(cfg.height, button.height) / 2,
  };
}

/**
 * A short notice on a plate of the kit: it slides up from the bottom edge, stays for a moment
 * and goes away. It draws above whatever the scene shows. With `over` (the button just tapped,
 * inside a window or not) it stands on that button instead and covers nothing else: on a button
 * as wide as the plate, above it on a narrower one (a square button next to Play).
 */
export function showToast(
  scene: Phaser.Scene,
  text: string,
  over?: Phaser.GameObjects.Container,
): void {
  const { width, height } = scene.scale.gameSize;
  // On a button the plate is never taller than the button, so it covers no neighbour.
  const plateHeight = over ? Math.min(cfg.height, over.height) : cfg.height;
  const plate = createPlate(scene, 'card', 0, 0, cfg.width, plateHeight, {
    fill: PALETTE.gold,
  });
  const label = fitText(
    createOutlinedText(scene, 0, 0, text, cfg.font),
    cfg.width - cfg.textPadding,
  );
  const spot = over ? spotOnButton(scene, over, width) : null;
  // The plate stands above the safe band at the bottom (the gesture bar).
  const y = spot?.y ?? safeFrame(height).bottom - cfg.bottom;
  const toast = scene.add
    .container(spot?.x ?? width / 2, y + (spot ? cfg.onButton.rise : cfg.height), [plate, label])
    .setDepth(cfg.depth)
    .setAlpha(0);
  // It stands on the canvas, also on a scene whose camera scrolls by the top inset (results).
  pinToCanvas(toast);
  scene.tweens.add({ targets: toast, y, alpha: 1, duration: cfg.inMs, ease: 'Back.easeOut' });
  scene.tweens.add({
    targets: toast,
    alpha: 0,
    delay: cfg.inMs + cfg.holdMs,
    duration: cfg.outMs,
    onComplete: () => toast.destroy(),
  });
}
