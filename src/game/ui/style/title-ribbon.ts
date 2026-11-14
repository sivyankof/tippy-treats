import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { shade } from '../../../util/color';
import { bakeTexture } from '../bake-texture';
import { fitText } from '../menu/fit-text';
import { createOutlinedText } from '../outlined-text';
import { drawVolume, lookOf, shadowMargin } from './volume';

const cfg = MENU.style.ribbon;
const S = MENU.style;
const look = lookOf('chip', cfg.radius);

type Graphics = Phaser.GameObjects.Graphics;

/** A tail folded behind the plate; `dir` 1 is the left tail (notch on the left), -1 the right. */
function tailPoints(
  edge: number,
  top: number,
  length: number,
  height: number,
  notch: number,
  dir: 1 | -1,
): Phaser.Math.Vector2[] {
  const v = (x: number, y: number): Phaser.Math.Vector2 => new Phaser.Math.Vector2(x, y);
  return [
    v(edge + dir * length, top),
    v(edge, top),
    v(edge + dir * notch, top + height / 2),
    v(edge, top + height),
    v(edge + dir * length, top + height),
  ];
}

function drawTail(g: Graphics, edge: number, top: number, dir: 1 | -1, fill: number): void {
  const { tail, tailHeight, notch } = cfg;
  const o = look.outline;
  g.fillStyle(S.shadowColor, look.shadowAlpha);
  g.fillPoints(tailPoints(edge, top + look.shadowOffset, tail, tailHeight, notch, dir), true);
  g.fillStyle(shade(fill, S.outlineShade), 1);
  g.fillPoints(tailPoints(edge, top, tail, tailHeight, notch, dir), true);
  const inner = tailPoints(
    edge + dir * o * 2,
    top + o,
    tail - o * 2,
    tailHeight - o * 2,
    notch,
    dir,
  );
  g.fillStyle(shade(fill, cfg.tailShade), 1).fillPoints(inner, true);
  const upper = tailPoints(
    edge + dir * o * 2,
    top + o,
    tail - o * 2,
    (tailHeight - o * 2) / 2,
    notch / 2,
    dir,
  );
  g.fillStyle(shade(fill, cfg.tailShade / 2), 1).fillPoints(upper, true);
}

/** Width of the plate for a label `labelWidth` wide: padded, stepped and clamped. */
function plateWidth(labelWidth: number): number {
  const stepped = Math.ceil((labelWidth + cfg.padX * 2) / cfg.widthStep) * cfg.widthStep;
  return Math.min(cfg.maxWidth, Math.max(cfg.minWidth, stepped));
}

/**
 * The title of a screen on a ribbon: a glossy plate with two folded tails behind its ends.
 * It is centred on its position and breathes a little; the label shrinks to fit the plate.
 */
export class TitleRibbon extends Phaser.GameObjects.Container {
  readonly label: Phaser.GameObjects.Text;
  private plate: Phaser.GameObjects.Image;
  private plateWidth: number;
  private readonly naturalWidth: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    private readonly fill: number = cfg.fill,
  ) {
    super(scene, x, y);
    this.label = createOutlinedText(scene, 0, -look.bevel / 2, text, cfg.font);
    this.naturalWidth = this.label.width;
    this.plateWidth = plateWidth(this.naturalWidth);
    fitText(this.label, this.plateWidth - cfg.padX * 2);
    this.plate = this.createPlate(scene, this.plateWidth, fill);
    this.add([this.plate, this.label]);
    scene.add.existing(this);
    scene.tweens.add({
      targets: this,
      scale: cfg.breathe.scale,
      duration: cfg.breathe.ms / 2,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  /** Total width of the ribbon with its tails. */
  get fullWidth(): number {
    return this.plateWidth + (cfg.tail - cfg.tuck) * 2;
  }

  /** Narrows the ribbon (tails included) to `maxWidth` at most; the label shrinks to fit. */
  setMaxWidth(maxWidth: number): void {
    const room = Math.floor((maxWidth - (cfg.tail - cfg.tuck) * 2) / cfg.widthStep) * cfg.widthStep;
    const width = Math.max(cfg.capMinWidth, Math.min(plateWidth(this.naturalWidth), room));
    if (width === this.plateWidth) return;
    this.plateWidth = width;
    const old = this.plate;
    this.plate = this.createPlate(this.scene, width, this.fill);
    this.addAt(this.plate, 0);
    old.destroy();
    fitText(this.label, width - cfg.padX * 2);
  }

  private createPlate(scene: Phaser.Scene, width: number, fill: number): Phaser.GameObjects.Image {
    const out = cfg.tail - cfg.tuck;
    const m = shadowMargin(look);
    const bodyWidth = width + out * 2;
    const bodyHeight = Math.max(cfg.height, cfg.tailDrop + cfg.tailHeight);
    const textureWidth = bodyWidth + m.side * 2;
    const textureHeight = bodyHeight + m.top + m.bottom;
    const key = `ui_ribbon_${width}_${fill.toString(16)}`;
    bakeTexture(scene, key, textureWidth, textureHeight, (g) => {
      const left = m.side;
      const tailTop = m.top + cfg.tailDrop;
      drawTail(g, left, tailTop, 1, fill);
      drawTail(g, left + bodyWidth, tailTop, -1, fill);
      drawVolume(g, left + out, m.top, width, cfg.height, look, { fill });
    });
    return new Phaser.GameObjects.Image(scene, 0, 0, key).setOrigin(
      0.5,
      (m.top + cfg.height / 2) / textureHeight,
    );
  }
}
