import * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { PALETTE } from '../../../data/common/palette';
import { attachPressFeedback, type PressFeedback } from '../common/button';
import { bakeTexture } from '../common/bake-texture';
import { createOutlinedText } from '../common/outlined-text';
import { fitText, onFontRefresh } from '../menu/widgets/fit-text';
import { createPlate, faceOffsetY } from './volume';

const cfg = MENU.style.tile;

/** Key of the ▼ mark of a button tile (turned over for ▲). */
export const TILE_MARK_KEY = 'ui_tile_mark';

/**
 * Bakes the ▼ mark once: a small gold plate with a dark triangle on it, a few pixels of room on
 * every side. Turned over, the same picture is ▲.
 */
export function bakeTileMark(scene: Phaser.Scene): void {
  const { width, height, radius, pad, fill, glyph } = cfg.mark;
  bakeTexture(scene, TILE_MARK_KEY, width + pad * 2, height + pad * 2, (g) => {
    g.fillStyle(fill, 1).fillRoundedRect(pad, pad, width, height, radius);
    const cx = pad + width / 2;
    const top = pad + (height - glyph * 0.62) / 2;
    const bottom = top + glyph * 0.62;
    g.fillStyle(PALETTE.textDark, 1);
    g.fillTriangle(cx - glyph / 2, top, cx + glyph / 2, top, cx, bottom);
  });
}

/** Size and type of a tile; `onTap` makes it a button tile. */
export interface StatTileOptions {
  width: number;
  height: number;
  /** The picture above the value; its centre is put on `iconY`. */
  icon: Phaser.GameObjects.GameObject & { setPosition(x: number, y: number): unknown };
  valueFont: number;
  labelFont: number;
  /** Centres of the icon, the value and the caption, from the tile centre. */
  iconY: number;
  valueY: number;
  labelY: number;
  /** Room kept free inside the left and right edges. */
  padX: number;
  label: string;
  /** A button tile: lighter, rimmed, with a ▼ / ▲ mark beside the caption; it calls this on a tap. */
  onTap?: () => void;
}

/**
 * A tile of numbers: an icon, a big value and a caption, top to bottom. A flat tile only shows;
 * a button tile (`onTap`) is a soft raised button with a gold rim and a ▼ mark beside its caption
 * that turns ▲ while what it opened is open (`setOpen`). (0, 0) is the centre of the tile body.
 */
export class StatTile extends Phaser.GameObjects.Container {
  readonly value: Phaser.GameObjects.Text;
  private readonly label: Phaser.GameObjects.Text;
  private readonly mark: Phaser.GameObjects.Image | null = null;
  private readonly press: PressFeedback | null = null;
  private readonly hitArea: Phaser.Geom.Rectangle | null = null;
  private readonly room: number;

  constructor(scene: Phaser.Scene, options: StatTileOptions) {
    super(scene, 0, 0);
    const { width, height, onTap } = options;
    const button = onTap !== undefined;
    const plate = createPlate(
      scene,
      button ? 'tileButton' : 'tile',
      0,
      0,
      width,
      height,
      button ? { fill: cfg.buttonFill, rim: cfg.buttonRim } : { fill: cfg.fill },
    );
    // A button tile's face is lifted by its step; its content goes up with it.
    const lift = button ? faceOffsetY('tileButton') : 0;
    this.room = width - options.padX * 2;
    options.icon.setPosition(0, options.iconY + lift);
    this.value = createOutlinedText(
      scene,
      0,
      options.valueY + lift,
      '',
      options.valueFont,
      PALETTE.gold,
    );
    this.label = createOutlinedText(
      scene,
      0,
      options.labelY + lift,
      options.label,
      options.labelFont,
    );
    this.add([plate, options.icon, this.value, this.label]);
    if (button) {
      bakeTileMark(scene);
      this.mark = scene.add.image(0, 0, TILE_MARK_KEY);
      this.add(this.mark);
      this.hitArea = new Phaser.Geom.Rectangle(0, 0, width, height);
      this.setSize(width, height);
      this.setInteractive(this.hitArea, Phaser.Geom.Rectangle.Contains);
      this.press = attachPressFeedback(this, { onTap });
    }
    this.layoutLabel();
    scene.add.existing(this);
  }

  /** Shows `text` as the value, fitted to the tile. */
  setValue(text: string): this {
    if (this.value.text !== text) {
      this.value.setText(text);
      fitText(this.value, this.room);
    }
    return this;
  }

  /** The mark of a button tile: ▲ while what it opened is open, ▼ otherwise. */
  setOpen(open: boolean): this {
    this.mark?.setFlipY(open);
    return this;
  }

  /** A button tile takes taps only while enabled. */
  setEnabled(enabled: boolean): this {
    if (!this.hitArea) return this;
    this.press?.cancel();
    if (enabled) this.setInteractive(this.hitArea, Phaser.Geom.Rectangle.Contains);
    else this.disableInteractive();
    return this;
  }

  /** The caption, and on a button tile the mark plate after it, centred together. */
  private layoutLabel(): void {
    const m = cfg.mark;
    const markWidth = this.mark ? m.width + m.gap : 0;
    fitText(this.label, this.room - markWidth);
    onFontRefresh(this.label, () => this.layoutLabel());
    const total = this.label.displayWidth + markWidth;
    this.label.setX(-total / 2 + this.label.displayWidth / 2);
    this.mark?.setPosition(total / 2 - m.width / 2, this.label.y);
  }
}
