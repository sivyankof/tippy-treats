import * as Phaser from 'phaser';
import { MENU } from '../../../../data/common/menu-layout';
import { PALETTE } from '../../../../data/common/palette';
import { createOutlinedText } from '../../common/outlined-text';
import { barFillWidth } from '../../style/bar-geometry';
import { drawBarFill, drawBarTrack } from '../../style/volume-bar';
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
 * Draws a bar centred on the origin: a dark frame, a grooved empty part and a fill with volume
 * (`style/volume-bar.ts`). Shared by the XP bar, the oven and the progress bar. `share` is 0..1.
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
  drawBarTrack(g, { left, top, width: w, height: h, radius }, { back: bar.back });
  const filled = barFillWidth(share, w, radius);
  if (filled > 0) drawBarFill(g, { left, top, width: filled, height: h, radius }, fill);
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
