import * as Phaser from 'phaser';

/** Columns of a picture: x, top and bottom of each one (content px); column `i` shows the texture at `us[i]` of its width (0..1, rising; set once). */
export interface Columns {
  us: Float32Array;
  /** Rows cut off the top of each column's picture (texture px, 0: none): the column shows the texture from that row down. */
  cuts: Float32Array;
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

  /** The picture is cut at the share of the texture each column stands for, not evenly. */
  override updateUVs(): this {
    const c = this.columns;
    if (!c) return super.updateUVs();
    const uv = this.uv;
    const frame = this.frame;
    const n = Math.min(c.us.length, uv.length / 4);
    const span = frame.u1 - frame.u0;
    for (let i = 0; i < n; i++) {
      const u = frame.u0 + (c.us[i] ?? 0) * span;
      uv[i * 4] = u;
      uv[i * 4 + 1] = frame.v0 + ((c.cuts[i] ?? 0) / frame.height) * (frame.v1 - frame.v0);
      uv[i * 4 + 2] = u;
      uv[i * 4 + 3] = frame.v1;
    }
    return this;
  }

  override updateVertices(): this {
    this.dirty = false;
    const c = this.columns;
    if (!c) return this;
    this.updateUVs();
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
      rope.columns = columns;
      rope.setTexture(texture).setTintMode(Phaser.TintModes.MULTIPLY);
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
    const fresh = texture !== this.texture;
    this.texture = texture;
    const { xs, tops, bottoms } = columns;
    for (let i = 0; i < n; i++) {
      const image = this.images[i];
      if (!image) continue;
      const from = (columns.us[i] ?? 0) * width;
      const slice = ((columns.us[i + 1] ?? 1) - (columns.us[i] ?? 0)) * width;
      const left = xs[i] ?? 0;
      const right = xs[i + 1] ?? left;
      const top = ((tops[i] ?? 0) + (tops[i + 1] ?? 0)) / 2;
      const bottom = ((bottoms[i] ?? 0) + (bottoms[i + 1] ?? 0)) / 2;
      const cut = ((columns.cuts[i] ?? 0) + (columns.cuts[i + 1] ?? 0)) / 2;
      // A hair wider than the gap, so no seam shows between neighbours.
      const scaleX = (right - left + 1) / slice;
      const scaleY = (bottom - top) / (height - cut);
      if (fresh) image.setTexture(texture);
      image
        .setCrop(from, cut, slice, height - cut)
        .setScale(scaleX, scaleY)
        .setPosition(left - from * scaleX, top - cut * scaleY)
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
  return scene.game.renderer.type === Phaser.CANVAS
    ? new ImageColumns(scene, count)
    : new RopeColumns(scene, count);
}
