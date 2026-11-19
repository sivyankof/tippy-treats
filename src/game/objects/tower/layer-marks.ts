import * as Phaser from 'phaser';
import { DEG_TO_RAD } from '../../../util/math';
import {
  layerMarks,
  markGrow,
  markVanish,
  markSwingDeg,
  squeezeScale,
  MAX_CUT_PICTURES,
  MAX_PRESS_PICTURES,
  type LayerMark,
  type LayerMarkStore,
} from './layer-mark-store';

export { layerMarks };

/** Pictures one layer view keeps for its marks. */
const PICTURES = MAX_CUT_PICTURES + MAX_PRESS_PICTURES;

/**
 * The pictures of the marks of the layer a view shows: children of the layer's `content`, drawn
 * from the same atlas page as the layer, so they add no draw call at rest. Shown only while the
 * view is a layer of the tower (or a layer of it falling in the collapse).
 */
export class LayerMarkPictures {
  readonly images: Phaser.GameObjects.Image[] = [];
  /** Pictures of cut marks: drawn under the shade of the layer above. */
  readonly cutImages: Phaser.GameObjects.Image[] = [];
  /** Pictures of press marks (stains, the cream roll and its drops): drawn above that shade, so it never greys them. */
  readonly pressImages: Phaser.GameObjects.Image[] = [];
  private readonly shown: Array<LayerMark | null> = [];
  private allowed = false;
  /** What the pictures were last placed for: nothing is placed again until one of these changes. */
  private placed: { layerIndex: number; store: LayerMarkStore; version: number } | null = null;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < PICTURES; i++) {
      const image = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setVisible(false);
      this.images.push(image);
      (i < MAX_CUT_PICTURES ? this.cutImages : this.pressImages).push(image);
      this.shown.push(null);
    }
  }

  setAllowed(on: boolean): void {
    if (this.allowed !== on) this.placed = null;
    this.allowed = on;
    if (!on) this.hide();
  }

  reset(): void {
    this.setAllowed(false);
  }

  /** Shows the marks of layer `layerIndex` (1-based), if the view may show marks. */
  update(layerIndex: number, store: LayerMarkStore = layerMarks): void {
    const last = this.placed;
    if (
      last &&
      last.layerIndex === layerIndex &&
      last.store === store &&
      last.version === store.version
    ) {
      return;
    }
    this.placed = { layerIndex, store, version: store.version };
    const set = this.allowed ? store.at(layerIndex) : undefined;
    if (!set) {
      this.hide();
      return;
    }
    for (let i = 0; i < MAX_CUT_PICTURES; i++) this.place(i, set.cut?.[i] ?? null);
    for (let i = 0; i < MAX_PRESS_PICTURES; i++) {
      this.place(MAX_CUT_PICTURES + i, set.press?.[i] ?? null);
    }
  }

  /** Grows and swings the shown marks; `alpha` follows the layer's art (a see-through layer). */
  tick(nowMs: number, alpha: number): void {
    for (let i = 0; i < PICTURES; i++) this.pose(i, nowMs, alpha);
  }

  private pose(slot: number, nowMs: number, alpha: number): void {
    const mark = this.shown[slot];
    const image = this.images[slot]!;
    if (!mark || !image.visible) return;
    const age = nowMs - mark.bornMs;
    const vanish = markVanish(mark, nowMs);
    const squeeze = mark.squeeze;
    const growX = squeeze ? squeezeScale(squeeze, age, 0) : markGrow(mark, age);
    const growY = squeeze ? squeezeScale(squeeze, age, 1) : growX;
    image
      .setScale(
        (mark.width / image.frame.width) * growX * vanish * (mark.flipX ? -1 : 1),
        (mark.height / image.frame.height) * growY * vanish,
      )
      .setRotation(((mark.angleDeg ?? 0) + markSwingDeg(mark, age)) * DEG_TO_RAD)
      .setAlpha(alpha);
  }

  private place(slot: number, mark: LayerMark | null): void {
    const image = this.images[slot]!;
    if (!mark) {
      image.setVisible(false);
      this.shown[slot] = null;
      return;
    }
    if (this.shown[slot] !== mark) {
      this.shown[slot] = mark;
      image.setTexture(mark.texture).setOrigin(mark.originX, mark.originY);
      if (mark.tint === undefined) image.clearTint();
      else {
        image
          .setTint(mark.tint)
          .setTintMode(
            mark.tintMode === 'overlay' ? Phaser.TintModes.OVERLAY : Phaser.TintModes.MULTIPLY,
          );
      }
    }
    image.setPosition(mark.dx, mark.dy).setVisible(true);
    this.pose(slot, image.scene.time.now, image.alpha);
  }

  private hide(): void {
    for (let i = 0; i < PICTURES; i++) {
      this.images[i]!.setVisible(false);
      this.shown[i] = null;
    }
  }
}
