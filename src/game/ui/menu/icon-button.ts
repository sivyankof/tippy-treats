import type * as Phaser from 'phaser';
import { PALETTE } from '../../../data/palette';
import { Button } from '../button';

/** Icons drawn in code on round buttons. */
export type IconKind = 'back' | 'close' | 'play' | 'shop' | 'collection' | 'daily' | 'missions';

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
    case 'play':
      g.fillTriangle(cx - s * 0.5, cy - s * 0.7, cx - s * 0.5, cy + s * 0.7, cx + s * 0.75, cy);
      return;
    case 'shop':
      g.fillRoundedRect(cx - s * 0.75, cy - s * 0.35, s * 1.5, s * 1.05, s * 0.18);
      g.beginPath();
      g.arc(cx, cy - s * 0.35, s * 0.45, Math.PI, 0);
      g.strokePath();
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
    case 'missions':
      g.beginPath();
      g.moveTo(cx - s * 0.65, cy);
      g.lineTo(cx - s * 0.15, cy + s * 0.5);
      g.lineTo(cx + s * 0.7, cy - s * 0.55);
      g.strokePath();
      return;
  }
}

/** A round button with an icon drawn on it; the shadow and the corners follow the size. */
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
    shadowColor: PALETTE.textDark,
    shadowOffset: Math.round(size * 0.07),
    textureKey: `ui_icon_${icon}_${size}_${fill.toString(16)}`,
    decorate: (g, w, h) => drawIcon(g, icon, w / 2, h / 2, size * 0.5),
    onClick,
  });
}
