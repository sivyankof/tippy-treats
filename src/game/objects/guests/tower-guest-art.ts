import type * as Phaser from 'phaser';
import type { GuestLook } from '../../../data/guests/tower-guest';
import { TOWER_GUEST } from '../../../data/guests/tower-guest';
import { DEG_TO_RAD, sineWave } from '../../../util/math';
import { ellipsePoints, fillPolygon } from '../../fx/common/plain-style';
import { bakeTexture } from '../../ui/common/bake-texture';
import { trembleAngle } from './tower-guest-plan';

/**
 * Bakes the flat picture of a guest: a pancake much wider than the guest, one wing pressed flat
 * under it and two big round eyes crossed out. The legs and the other wing that stick out of it
 * are drawn live by `drawFlatLimbs`. Nothing but the guest's own colours.
 */
export function bakeGuestFlat(scene: Phaser.Scene, look: GuestLook): void {
  const f = look.flat;
  const { width: w, height: h } = f;
  bakeTexture(scene, f.texture, w, h, (g) => {
    const cx = w / 2;
    const cy = h * f.bodyY;
    const eye = h * f.eyeRadiusShare;
    const wing = f.flatWing;
    g.fillStyle(f.wing, f.wingAlpha);
    g.fillEllipse(cx - w * wing.x, h * wing.y, w * wing.width, h * wing.height);
    g.fillStyle(f.body, 1);
    g.fillEllipse(cx, cy, w * f.bodyWidth, h * f.bodyHeight);
    const arm = eye * f.crossShare;
    for (const side of [-1, 1]) {
      const ex = cx + side * w * f.eyeX;
      const ey = h * f.eyeY;
      g.fillStyle(f.outline, 1);
      g.fillCircle(ex, ey, eye + f.eyeRingPx);
      g.fillStyle(f.eyeWhite, 1);
      g.fillCircle(ex, ey, eye);
      g.lineStyle(f.crossPx, f.pupil, 1);
      g.lineBetween(ex - arm, ey - arm, ex + arm, ey + arm);
      g.lineBetween(ex - arm, ey + arm, ex + arm, ey - arm);
    }
  });
}

/**
 * Draws the legs and the wing that stick out of the pancake into `g` (flat picture pixels): three
 * legs fanning out on each side and one wing standing up, all shivering when `trembling`.
 */
export function drawFlatLimbs(
  g: Phaser.GameObjects.Graphics,
  look: GuestLook,
  timeMs: number,
  trembling: boolean,
): void {
  const f = look.flat;
  const { legs, wingOut } = f;
  const { tremble } = TOWER_GUEST.splat;
  const shiver = (index: number, deg: number): number =>
    trembling ? trembleAngle(index, timeMs, deg) : 0;
  const cx = f.width / 2;
  const y = f.height * legs.y;
  g.clear();
  g.fillStyle(f.wing, f.wingAlpha);
  const wingRad = wingOut.angleDeg * DEG_TO_RAD + shiver(legs.fanDeg.length * 2, tremble.wingDeg);
  const half = wingOut.lengthPx / 2;
  fillPolygon(
    g,
    ellipsePoints(
      cx + f.width * wingOut.x + Math.cos(wingRad) * half,
      f.height * wingOut.y + Math.sin(wingRad) * half,
      half,
      wingOut.widthPx / 2,
      wingRad,
    ),
  );
  g.lineStyle(look.legs.widthPx, look.legs.color, 1);
  legs.fanDeg.forEach((deg, i) => {
    for (const side of [-1, 1]) {
      const rad = deg * DEG_TO_RAD + shiver(i * 2 + (side > 0 ? 1 : 0), tremble.legDeg);
      const x = cx + side * f.width * legs.x;
      g.lineBetween(
        x,
        y,
        x + side * Math.cos(rad) * legs.lengthPx,
        y + Math.sin(rad) * legs.lengthPx,
      );
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
