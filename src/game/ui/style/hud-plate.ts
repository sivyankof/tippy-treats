import * as Phaser from 'phaser';
import { MENU } from '../../../data/common/menu-layout';
import { PALETTE } from '../../../data/common/palette';
import { TextureRefCache } from '../texture-ref-cache';
import { createVolumeImage, lookOf } from './volume';

const cfg = MENU.style.hud;

/** The width a HUD plate is drawn at for a requested body width (rounded up to the width step). */
export function hudPlateWidth(width: number): number {
  return Math.ceil(width / cfg.widthStep) * cfg.widthStep;
}

/** The users of the baked plate pictures; unused ones stay until `trimHudPlates`. */
const plateRefs = new TextureRefCache(cfg.idlePlates);

/**
 * Removes the unused plate pictures beyond `MENU.style.hud.idlePlates` (the oldest first); they
 * hold room on the shared atlas page. Call it only where no plate is about to be placed again:
 * a run's start and end. During a run a plate's size goes both ways (a countdown, a name), and a
 * picture removed then would be baked again in the middle of the run.
 */
export function trimHudPlates(scene: Phaser.Scene): void {
  plateRefs.evict((key) => scene.textures.remove(key));
}

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
  private key = '';

  constructor(
    scene: Phaser.Scene,
    private readonly fill: number = PALETTE.panel,
    private readonly plateAlpha: number = cfg.alpha,
  ) {
    super(scene, 0, 0);
    scene.add.existing(this);
  }

  /** Centres the plate on (x, y), its body `width` x `height`. */
  place(x: number, y: number, width: number, height: number): this {
    const w = hudPlateWidth(width);
    const h = Math.round(height);
    const size = `${w}x${h}`;
    if (size !== this.size) {
      this.size = size;
      this.plate?.destroy();
      const key = `ui_hud_plate_${size}_${this.fill.toString(16)}`;
      // The new picture is held before the old one is given back, so they never trade places.
      plateRefs.acquire(key);
      if (this.key) plateRefs.release(this.key);
      this.key = key;
      this.plate = createVolumeImage(this.scene, key, w, h, lookOf('chip'), {
        fill: this.fill,
      }).setAlpha(this.plateAlpha);
      this.add(this.plate);
    }
    return this.setPosition(x, y);
  }

  override destroy(fromScene?: boolean): void {
    const key = this.key;
    super.destroy(fromScene);
    // Phaser skips a destroy that already happened (no scene): the picture is given back once.
    if (key && !this.scene) {
      this.key = '';
      plateRefs.release(key);
    }
  }
}
