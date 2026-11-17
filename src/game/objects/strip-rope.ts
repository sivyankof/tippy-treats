import * as Phaser from 'phaser';

/**
 * A rope whose vertices are written by the owner every frame and whose picture never changes
 * between frames: a baked triangle strip that only bends. A row is a pair of vertices (left,
 * right), four floats `x0, y0, x1, y1`; the uv are given as shares of the picture.
 */
export class StripRope extends Phaser.GameObjects.Rope {
  constructor(scene: Phaser.Scene, texture: string, uv: Float32Array) {
    super(scene, 0, 0, texture, undefined, uv.length / 4);
    this.mapUvs(uv);
    this.setVisible(false);
  }

  /**
   * Sets the uv from shares of the picture: the frame knows where its corners are in the texture
   * (a baked picture can sit upside down in it, or on a page of the shared atlas).
   */
  mapUvs(uv: Float32Array): this {
    const { u0, v0, u1, v1 } = this.frame;
    for (let i = 0; i < uv.length; i += 2) {
      this.uv[i] = u0 + uv[i]! * (u1 - u0);
      this.uv[i + 1] = v0 + uv[i + 1]! * (v1 - v0);
    }
    return this;
  }

  /** The vertices are the owner's: nothing is recomputed from the points. */
  override updateVertices(): this {
    this.dirty = false;
    return this;
  }

  /** The uv are set by `mapUvs` and kept. */
  override updateUVs(): this {
    return this;
  }
}
