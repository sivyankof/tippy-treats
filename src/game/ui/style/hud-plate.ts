import * as Phaser from 'phaser';
import { MENU } from '../../../data/menu-layout';
import { PALETTE } from '../../../data/palette';
import { createVolumeImage, lookOf } from './volume';

const cfg = MENU.style.hud;

/** The width a HUD plate is drawn at for a requested body width (rounded up to the width step). */
export function hudPlateWidth(width: number): number {
  return Math.ceil(width / cfg.widthStep) * cfg.widthStep;
}

/** How many plates show each baked picture; a picture nobody shows goes to `idleKeys` (oldest first). */
const users = new Map<string, number>();
const idleKeys: string[] = [];

function takePlate(key: string): void {
  users.set(key, (users.get(key) ?? 0) + 1);
  const at = idleKeys.indexOf(key);
  if (at >= 0) idleKeys.splice(at, 1);
}

/** Gives a picture back; pictures beyond `cfg.idlePlates` unused ones are removed (they hold room on the shared atlas page). */
function dropPlate(scene: Phaser.Scene, key: string): void {
  const left = (users.get(key) ?? 1) - 1;
  if (left > 0) {
    users.set(key, left);
    return;
  }
  users.delete(key);
  idleKeys.push(key);
  while (idleKeys.length > cfg.idlePlates) {
    const old = idleKeys.shift();
    if (old) scene.textures.remove(old);
  }
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
      if (this.key) dropPlate(this.scene, this.key);
      const key = `ui_hud_plate_${size}_${this.fill.toString(16)}`;
      this.key = key;
      takePlate(key);
      this.plate = createVolumeImage(this.scene, key, w, h, lookOf('chip'), {
        fill: this.fill,
      }).setAlpha(this.plateAlpha);
      this.add(this.plate);
    }
    return this.setPosition(x, y);
  }

  override destroy(fromScene?: boolean): void {
    if (this.key) dropPlate(this.scene, this.key);
    this.key = '';
    super.destroy(fromScene);
  }
}
