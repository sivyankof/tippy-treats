import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { shade } from '../../../util/color';
import { createOutlinedText } from '../outlined-text';
import { fitText } from './fit-text';

const bar = MENU.xpBar;
const cfg = MENU.progressBar;

/** Size and corners of a bar centred on the origin of its graphics. */
export interface BarShape {
  width: number;
  height: number;
  radius: number;
  border: number;
}

/**
 * Draws a bar centred on the origin: a dark frame, a grooved empty part and a glossy fill.
 * Shared by the XP bar and the progress bar. `share` is 0..1.
 */
export function drawProgressBar(
  graphics: Phaser.GameObjects.Graphics,
  shape: BarShape,
  share: number,
  fill: number,
): void {
  const { width: w, height: h, border } = shape;
  const radius = Math.min(shape.radius, h / 2);
  const left = -w / 2;
  const top = -h / 2;
  const g = graphics.clear();
  g.fillStyle(PALETTE.textDark, 1).fillRoundedRect(
    left - border,
    top - border,
    w + border * 2,
    h + border * 2,
    radius + border,
  );
  g.fillStyle(bar.back, 1).fillRoundedRect(left, top, w, h, radius);
  // A groove: the upper part of the empty bar is in the shade of its rim.
  g.fillStyle(shade(bar.back, bar.groove), 1).fillRoundedRect(left, top, w, h / 2, {
    tl: radius,
    tr: radius,
    bl: 0,
    br: 0,
  });
  const filled = Math.max(0, Math.min(1, share)) * w;
  if (filled > 0) {
    const fw = Math.max(filled, radius * 2);
    g.fillStyle(fill, 1).fillRoundedRect(left, top, fw, h, radius);
    const gh = h * bar.gloss.share;
    g.fillStyle(PALETTE.textLight, bar.gloss.alpha);
    g.fillRoundedRect(left + radius / 2, top + bar.gloss.inset, fw - radius, gh, gh / 2);
  }
}

/**
 * A plain progress bar with a label in the middle ("3 / 5"), drawn like the XP bar: a dark
 * frame, a grooved empty part and a glossy fill. (x, y) is the centre. `setShare` takes 0..1.
 */
export class ProgressBar extends Phaser.GameObjects.Container {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private share = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly barWidth: number,
    private readonly barHeight: number,
    font: number,
    private readonly fill: number = PALETTE.success,
  ) {
    super(scene, x, y);
    this.graphics = scene.add.graphics();
    this.label = createOutlinedText(scene, 0, 0, '', font);
    this.add([this.graphics, this.label]);
    scene.add.existing(this);
    this.setShare(0);
  }

  /** The text in the middle of the bar; it shrinks to fit the bar. */
  setLabel(text: string): this {
    this.label.setText(text);
    fitText(this.label, this.barWidth - cfg.radius);
    return this;
  }

  /** Where the label sits (for pop animations). */
  get labelObject(): Phaser.GameObjects.Text {
    return this.label;
  }

  get current(): number {
    return this.share;
  }

  setShare(share: number): this {
    this.share = Math.max(0, Math.min(1, share));
    drawProgressBar(
      this.graphics,
      { width: this.barWidth, height: this.barHeight, radius: cfg.radius, border: cfg.border },
      this.share,
      this.fill,
    );
    return this;
  }
}
