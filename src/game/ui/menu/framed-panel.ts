import type * as Phaser from 'phaser';

export interface FramedPanelStyle {
  radius: number;
  /** Thickness of the frame. */
  border: number;
  borderColor: number;
  fill: number;
}

/**
 * Draws a rounded panel with a frame: a rounded rectangle in the frame colour with the fill
 * inset by the frame thickness. (x, y) is the top-left corner.
 */
export function drawFramedPanel(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  style: FramedPanelStyle,
): void {
  const { radius, border, borderColor, fill } = style;
  g.fillStyle(borderColor, 1).fillRoundedRect(x, y, width, height, radius);
  g.fillStyle(fill, 1).fillRoundedRect(
    x + border,
    y + border,
    width - border * 2,
    height - border * 2,
    radius - border,
  );
}
