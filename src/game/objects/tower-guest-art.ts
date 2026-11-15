import type * as Phaser from 'phaser';
import type { GuestLook } from '../../data/tower-guest';
import { TOWER_GUEST } from '../../data/tower-guest';
import { sineWave } from '../../util/math';
import { bakeTexture } from '../ui/bake-texture';

/**
 * Bakes the flat picture of a guest: a pancake with splayed wings, little feet at its sides
 * and two big round eyes bulging up, their pupils crossed. Nothing but the guest's own colours.
 */
export function bakeGuestFlat(scene: Phaser.Scene, look: GuestLook): void {
  const {
    texture,
    width: w,
    height: h,
    body,
    wing,
    wingAlpha,
    eyeWhite,
    pupil,
    outline,
    eyeRadiusShare,
    eyeRingPx,
  } = look.flat;
  bakeTexture(scene, texture, w, h, (g) => {
    const cx = w / 2;
    const cy = h * 0.7;
    const eye = h * eyeRadiusShare;
    g.fillStyle(wing, wingAlpha);
    g.fillEllipse(cx - w * 0.3, cy - h * 0.06, w * 0.3, h * 0.2);
    g.fillEllipse(cx + w * 0.3, cy - h * 0.06, w * 0.3, h * 0.2);
    g.fillStyle(body, 1);
    g.fillEllipse(cx, cy, w * 0.5, h * 0.3);
    for (const side of [-1, 1]) {
      for (const step of [0, 1, 2]) {
        g.fillEllipse(cx + side * (w * 0.2 + step * w * 0.07), cy + h * 0.14, w * 0.06, h * 0.09);
      }
    }
    for (const side of [-1, 1]) {
      const ex = cx + side * w * 0.12;
      const ey = cy - h * 0.3;
      g.fillStyle(outline, 1);
      g.fillCircle(ex, ey, eye + eyeRingPx);
      g.fillStyle(eyeWhite, 1);
      g.fillCircle(ex, ey, eye);
      g.fillStyle(pupil, 1);
      g.fillCircle(ex - side * eye * 0.32, ey + eye * 0.12, eye * 0.38);
    }
  });
}

/**
 * Draws the legs of a resting guest into `g` (picture pixels, the feet line at `feetY`): four
 * short legs and, in front, the pair that rubs together over the head.
 */
export function drawGuestLegs(
  g: Phaser.GameObjects.Graphics,
  look: GuestLook,
  timeMs: number,
  headSide: -1 | 1,
): void {
  const { rub } = TOWER_GUEST;
  const { x, y, color, widthPx, backAt, backTopPx, backLeanPx, footDropPx, front } = look.legs;
  const feet = look.feetY;
  const { width } = look.size;
  const cx = width / 2;
  const head = cx + headSide * (cx - x);
  g.clear();
  g.lineStyle(widthPx, color, 1);
  // The two pairs at the back and the middle stand on the layer.
  for (const dx of backAt) {
    const lx = cx - headSide * dx * width;
    g.lineBetween(lx, y - backTopPx, lx - headSide * backLeanPx, feet + footDropPx);
  }
  // The front pair rubs: the legs swing in opposite directions across each other.
  const swing = rub.swingPx * sineWave(timeMs, rub.periodMs);
  for (const dir of [-1, 1]) {
    const tipX = head + headSide * (front.reachPx + dir * swing * front.swingX);
    g.lineBetween(
      head - headSide * front.baseInsetPx,
      y - backTopPx,
      tipX,
      y - front.risePx + dir * swing * front.swingY,
    );
  }
}
