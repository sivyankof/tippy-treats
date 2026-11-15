import * as Phaser from 'phaser';
import { readDebugParams } from '../../util/debug-params';

/** Dev-only `?edge=` probe (see `DebugParams.edge`); `undefined` in a normal run. */
export const EDGE_PROBE = readDebugParams().edge;
/** The fill of the rope under `?edge=tint`: loud, so its real triangles show. */
const EDGE_PROBE_TINT = 0xff00ff;

/** Columns of a picture: x, top and bottom of each one (content px); column `i` shows the texture at `i / (n - 1)` of its width. */
export interface Columns {
  xs: Float32Array;
  tops: Float32Array;
  bottoms: Float32Array;
}

/** Draws a baked texture through its columns; the texture itself is never redrawn. */
export interface ColumnView {
  readonly parts: Phaser.GameObjects.GameObject[];
  /** Shows `texture` (its frame `width` x `height`) laid on `columns`. */
  show(
    texture: string,
    width: number,
    height: number,
    columns: Readonly<Columns>,
    alpha: number,
  ): void;
  hide(): void;
}

/** A rope whose vertices are the columns themselves: smooth in every direction. */
class ColumnRope extends Phaser.GameObjects.Rope {
  /** Set after construction; the rope's own constructor runs before it and finds none. */
  columns: Readonly<Columns> | null = null;

  override updateVertices(): this {
    this.dirty = false;
    const c = this.columns;
    if (!c) return this;
    const v = this.vertices;
    const n = Math.min(c.xs.length, v.length / 4);
    for (let i = 0; i < n; i++) {
      const at = i * 4;
      const x = c.xs[i] ?? 0;
      v[at] = x;
      v[at + 1] = c.tops[i] ?? 0;
      v[at + 2] = x;
      v[at + 3] = c.bottoms[i] ?? 0;
    }
    return this;
  }
}

/** WebGL: one rope strip through all the columns. */
class RopeColumns implements ColumnView {
  private readonly rope: ColumnRope;
  private texture = '';

  constructor(scene: Phaser.Scene, count: number) {
    this.rope = new ColumnRope(scene, 0, 0, '__DEFAULT', undefined, count);
    this.rope.setVisible(false);
  }

  get parts(): Phaser.GameObjects.GameObject[] {
    return [this.rope];
  }

  show(texture: string, _w: number, _h: number, columns: Readonly<Columns>, alpha: number): void {
    const rope = this.rope;
    if (texture !== this.texture) {
      this.texture = texture;
      rope.setTexture(texture).setTintMode(Phaser.TintModes.MULTIPLY);
      if (EDGE_PROBE === 'tint') rope.setTintMode(Phaser.TintModes.FILL).setColors(EDGE_PROBE_TINT);
      rope.updateUVs();
    }
    rope.columns = columns;
    rope.setDirty().setAlpha(alpha).setVisible(true);
  }

  hide(): void {
    this.rope.setVisible(false);
  }
}

/**
 * Canvas has no rope (its renderer draws nothing for it), so there each pair of neighbour
 * columns is a cropped copy of the picture, scaled to fit between them: the top edge steps a
 * little, the shape is the same.
 */
class ImageColumns implements ColumnView {
  private readonly images: Phaser.GameObjects.Image[] = [];
  private texture = '';

  constructor(scene: Phaser.Scene, count: number) {
    for (let i = 0; i < count - 1; i++) {
      this.images.push(
        new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setOrigin(0, 0).setVisible(false),
      );
    }
  }

  get parts(): Phaser.GameObjects.GameObject[] {
    return this.images;
  }

  show(
    texture: string,
    width: number,
    height: number,
    columns: Readonly<Columns>,
    alpha: number,
  ): void {
    const n = this.images.length;
    const slice = width / n;
    const fresh = texture !== this.texture;
    this.texture = texture;
    const { xs, tops, bottoms } = columns;
    for (let i = 0; i < n; i++) {
      const image = this.images[i];
      if (!image) continue;
      if (fresh) image.setTexture(texture).setCrop(i * slice, 0, slice, height);
      const left = xs[i] ?? 0;
      const right = xs[i + 1] ?? left;
      const top = ((tops[i] ?? 0) + (tops[i + 1] ?? 0)) / 2;
      const bottom = ((bottoms[i] ?? 0) + (bottoms[i + 1] ?? 0)) / 2;
      // A hair wider than the gap, so no seam shows between neighbours.
      const scaleX = (right - left + 1) / slice;
      const scaleY = (bottom - top) / height;
      image
        .setScale(scaleX, scaleY)
        .setPosition(left - i * slice * scaleX, top)
        .setAlpha(alpha)
        .setVisible(true);
    }
  }

  hide(): void {
    for (const image of this.images) image.setVisible(false);
  }
}

/** The column view the renderer can draw: a rope on WebGL, cropped images on Canvas. */
export function createColumnView(scene: Phaser.Scene, count: number): ColumnView {
  return scene.game.renderer.type === Phaser.CANVAS || EDGE_PROBE === 'img'
    ? new ImageColumns(scene, count)
    : new RopeColumns(scene, count);
}
