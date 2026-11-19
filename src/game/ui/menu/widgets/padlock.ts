import type * as Phaser from 'phaser';
import { PALETTE } from '../../../../data/common/palette';

/** A padlock drawn in code, centred at (x, y), `size` tall. */
export function drawPadlock(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
): void {
  const bodyW = size * 0.78;
  const bodyH = size * 0.55;
  const top = y - size / 2 + size * 0.45;
  const shackle = bodyW * 0.3;
  g.lineStyle(size * 0.14, PALETTE.textLight, 1);
  g.beginPath();
  g.moveTo(x - shackle, top + size * 0.1);
  g.lineTo(x - shackle, top);
  g.arc(x, top, shackle, Math.PI, 0);
  g.lineTo(x + shackle, top + size * 0.1);
  g.strokePath();
  g.fillStyle(PALETTE.textDark, 1);
  g.fillRoundedRect(x - bodyW / 2 - 4, top - 2, bodyW + 8, bodyH + 8, size * 0.14);
  g.fillStyle(PALETTE.gold, 1).fillRoundedRect(x - bodyW / 2, top, bodyW, bodyH, size * 0.12);
  g.fillStyle(PALETTE.textDark, 1).fillCircle(x, top + bodyH * 0.4, size * 0.07);
  g.fillRect(x - size * 0.025, top + bodyH * 0.4, size * 0.05, bodyH * 0.3);
}
