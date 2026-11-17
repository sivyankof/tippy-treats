import * as Phaser from 'phaser';
import { DEG_TO_RAD } from '../../util/math';
import {
  layerMarks,
  markGrow,
  markSwingDeg,
  MAX_PRESS_PICTURES,
  type LayerMark,
  type LayerMarkStore,
} from './layer-mark-store';

export { layerMarks };

/** Pictures one layer view keeps for its marks. */
const PICTURES = 1 + MAX_PRESS_PICTURES;

/**
 * The pictures of the marks of the layer a view shows: children of the layer's `content`, drawn
 * from the same atlas page as the layer, so they add no draw call at rest. Shown only while the
 * view is a layer of the tower (or a layer of it falling in the collapse).
 */
export class LayerMarkPictures {
  readonly images: Phaser.GameObjects.Image[] = [];
  private readonly shown: Array<LayerMark | null> = [];
  private allowed = false;

  constructor(scene: Phaser.Scene) {
    for (let i = 0; i < PICTURES; i++) {
      this.images.push(new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setVisible(false));
      this.shown.push(null);
    }
  }

  setAllowed(on: boolean): void {
    this.allowed = on;
    if (!on) this.hide();
  }

  reset(): void {
    this.setAllowed(false);
  }

  /** Shows the marks of layer `layerIndex` (1-based), if the view may show marks. */
  update(layerIndex: number, store: LayerMarkStore = layerMarks): void {
    const set = this.allowed ? store.at(layerIndex) : undefined;
    if (!set) {
      this.hide();
      return;
    }
    this.place(0, set.cut ?? null);
    for (let i = 0; i < MAX_PRESS_PICTURES; i++) this.place(1 + i, set.press?.[i] ?? null);
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
    const grow = markGrow(mark, age);
    image
      .setScale(
        (mark.width / image.frame.width) * grow * (mark.flipX ? -1 : 1),
        (mark.height / image.frame.height) * grow,
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
