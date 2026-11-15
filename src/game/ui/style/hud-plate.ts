import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { createVolumeImage, lookOf } from './volume';

const cfg = MENU.style.hud;

/**
 * A plate of the run HUD: a chip of the kit, see-through (`MENU.style.hud.alpha`) so the tower
 * shows under it. It sits behind a label, a gauge or a counter and takes any size. Its position
 * is the centre of the body; the alpha is on the plate inside, so transitions may fade the
 * container freely.
 *
 * Unlike `VolumePlate` it is one image baked for its size (widths rounded up to
 * `MENU.style.hud.widthStep`), not a nine-slice: HUD plates sway and tilt, and a tilted
 * nine-slice breaks up in Phaser 4 (docs/08, journal).
 */
export class HudPlate extends Phaser.GameObjects.Container {
  private plate: Phaser.GameObjects.Image | null = null;
  private size = '';

  constructor(
    scene: Phaser.Scene,
    private readonly fill: number = PALETTE.panel,
  ) {
    super(scene, 0, 0);
    scene.add.existing(this);
  }

  /** Centres the plate on (x, y), its body `width` x `height`. */
  place(x: number, y: number, width: number, height: number): this {
    const w = Math.ceil(width / cfg.widthStep) * cfg.widthStep;
    const h = Math.round(height);
    const size = `${w}x${h}`;
    if (size !== this.size) {
      this.size = size;
      this.plate?.destroy();
      const key = `ui_hud_plate_${size}_${this.fill.toString(16)}`;
      this.plate = createVolumeImage(this.scene, key, w, h, lookOf('chip'), {
        fill: this.fill,
      }).setAlpha(cfg.alpha);
      this.add(this.plate);
    }
    return this.setPosition(x, y);
  }
}
