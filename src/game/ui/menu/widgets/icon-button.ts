import type * as Phaser from 'phaser';
import { PALETTE } from '../../../../data/common/palette';
import { Button } from '../../common/button';

/** Icons drawn in code on round buttons. */
export type IconKind =
  | 'back'
  | 'close'
  | 'pause'
  | 'play'
  | 'shop'
  | 'collection'
  | 'daily'
  | 'missions'
  | 'settings'
  | 'about';

/** The gear: how many teeth it has. */
const GEAR_TEETH = 8;

/** Line width of the stroked icons, as a share of the icon size. */
const STROKE = 0.14;

/** Draws `kind` centred at (cx, cy), about `size` across, in the light colour. */
export function drawIcon(
  g: Phaser.GameObjects.Graphics,
  kind: IconKind,
  cx: number,
  cy: number,
  size: number,
): void {
  const s = size / 2;
  g.fillStyle(PALETTE.textLight, 1);
  g.lineStyle(size * STROKE, PALETTE.textLight, 1);
  switch (kind) {
    case 'back':
      g.beginPath();
      g.moveTo(cx + s * 0.35, cy - s * 0.7);
      g.lineTo(cx - s * 0.4, cy);
      g.lineTo(cx + s * 0.35, cy + s * 0.7);
      g.strokePath();
      return;
    case 'close':
      g.lineBetween(cx - s * 0.6, cy - s * 0.6, cx + s * 0.6, cy + s * 0.6);
      g.lineBetween(cx + s * 0.6, cy - s * 0.6, cx - s * 0.6, cy + s * 0.6);
      return;
    case 'pause':
      g.fillRoundedRect(cx - s * 0.6, cy - s * 0.7, s * 0.42, s * 1.4, s * 0.21);
      g.fillRoundedRect(cx + s * 0.18, cy - s * 0.7, s * 0.42, s * 1.4, s * 0.21);
      return;
    case 'play':
      g.fillTriangle(cx - s * 0.5, cy - s * 0.7, cx - s * 0.5, cy + s * 0.7, cx + s * 0.75, cy);
      return;
    case 'shop':
      // A shopping cart: handle, basket and two wheels.
      g.beginPath();
      g.moveTo(cx - s * 0.9, cy - s * 0.65);
      g.lineTo(cx - s * 0.55, cy - s * 0.65);
      g.lineTo(cx - s * 0.3, cy + s * 0.4);
      g.lineTo(cx + s * 0.7, cy + s * 0.4);
      g.strokePath();
      g.fillTriangle(
        cx - s * 0.5,
        cy - s * 0.4,
        cx + s * 0.85,
        cy - s * 0.4,
        cx + s * 0.65,
        cy + s * 0.2,
      );
      g.fillTriangle(
        cx - s * 0.5,
        cy - s * 0.4,
        cx + s * 0.65,
        cy + s * 0.2,
        cx - s * 0.35,
        cy + s * 0.2,
      );
      g.fillCircle(cx - s * 0.1, cy + s * 0.75, s * 0.17);
      g.fillCircle(cx + s * 0.55, cy + s * 0.75, s * 0.17);
      return;
    case 'collection':
      g.fillRoundedRect(cx - s * 0.8, cy - s * 0.7, s * 0.72, s * 1.4, s * 0.14);
      g.fillRoundedRect(cx + s * 0.08, cy - s * 0.7, s * 0.72, s * 1.4, s * 0.14);
      return;
    case 'daily':
      g.fillRoundedRect(cx - s * 0.75, cy - s * 0.55, s * 1.5, s * 1.3, s * 0.18);
      g.fillRect(cx - s * 0.45, cy - s * 0.85, s * 0.16, s * 0.4);
      g.fillRect(cx + s * 0.29, cy - s * 0.85, s * 0.16, s * 0.4);
      g.fillStyle(PALETTE.accent, 1);
      g.fillRect(cx - s * 0.55, cy - s * 0.2, s * 1.1, s * 0.12);
      return;
    case 'settings':
      // A gear: a ring with short thick teeth around it.
      g.lineStyle(size * STROKE * 0.9, PALETTE.textLight, 1);
      g.strokeCircle(cx, cy, s * 0.5);
      g.lineStyle(size * STROKE * 1.2, PALETTE.textLight, 1);
      for (let i = 0; i < GEAR_TEETH; i++) {
        const a = (i / GEAR_TEETH) * Math.PI * 2;
        g.lineBetween(
          cx + Math.cos(a) * s * 0.72,
          cy + Math.sin(a) * s * 0.72,
          cx + Math.cos(a) * s * 0.95,
          cy + Math.sin(a) * s * 0.95,
        );
      }
      return;
    case 'about':
      // A speech bubble with three dots.
      g.fillRoundedRect(cx - s * 0.9, cy - s * 0.8, s * 1.8, s * 1.15, s * 0.35);
      g.fillTriangle(
        cx - s * 0.45,
        cy + s * 0.3,
        cx - s * 0.5,
        cy + s * 0.95,
        cx + s * 0.1,
        cy + s * 0.3,
      );
      g.fillStyle(PALETTE.textDark, 1);
      for (const dx of [-0.45, 0, 0.45]) g.fillCircle(cx + s * dx, cy - s * 0.22, s * 0.14);
      return;
    case 'missions':
      g.beginPath();
      g.moveTo(cx - s * 0.65, cy);
      g.lineTo(cx - s * 0.15, cy + s * 0.5);
      g.lineTo(cx + s * 0.7, cy - s * 0.55);
      g.strokePath();
      return;
  }
}

/** A rounded square menu button with an icon drawn on it; the bevel and the corners follow the size. */
export function createIconButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  size: number,
  fill: number,
  icon: IconKind,
  onClick: () => void,
): Button {
  return new Button(scene, {
    x,
    y,
    width: size,
    height: size,
    radius: size * 0.3,
    fill,
    shadowOffset: Math.round(size * 0.07),
    textureKey: `ui_icon_${icon}_${size}_${fill.toString(16)}`,
    decorate: (g, w, h) => drawIcon(g, icon, w / 2, h / 2, size * 0.5),
    onClick,
  });
}
