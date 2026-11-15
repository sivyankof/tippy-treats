import * as Phaser from 'phaser';
import { LICK } from '../../data/lick';
import { GraphicsTongue, type TongueParts } from './tongue-graphics';
import type { Ribbon } from './tongue-ribbon';
import {
  bodyUvs,
  CAP_ROWS,
  solidUvs,
  tipUvs,
  TRUNK_ROWS,
  writeCapRows,
  writeRow,
  writeTipRows,
  writeTrunkRows,
} from './tongue-strip-geometry';
import { bakeStripTextures, STRIP_TEXTURES } from './tongue-strip-texture';

/** A rope whose vertices are written by the owner every frame and whose picture never changes. */
class StripRope extends Phaser.GameObjects.Rope {
  constructor(scene: Phaser.Scene, texture: string, uv: Float32Array) {
    super(scene, 0, 0, texture, undefined, uv.length / 4);
    // The uv are shares of the picture; the frame knows where its corners are in the texture
    // (a baked picture can sit upside down in it).
    const { u0, v0, u1, v1 } = this.frame;
    for (let i = 0; i < uv.length; i += 2) {
      this.uv[i] = u0 + uv[i]! * (u1 - u0);
      this.uv[i + 1] = v0 + uv[i + 1]! * (v1 - v0);
    }
    this.setVisible(false);
  }

  /** The vertices are the owner's: nothing is recomputed from the points. */
  override updateVertices(): this {
    this.dirty = false;
    return this;
  }

  /** The uv are set once and kept. */
  override updateUVs(): this {
    return this;
  }
}

/**
 * The tongue as three baked triangle strips that only bend (WebGL): the outline (the whole
 * ribbon with its rounded root and tip, wider by the outline), the body, and the tip over the saliva. Each
 * frame only the vertices move; nothing is drawn.
 */
export class StripTongue implements TongueParts {
  private readonly outline: StripRope;
  private readonly trunk: StripRope;
  private readonly tip: StripRope;
  readonly under: readonly Phaser.GameObjects.GameObject[];
  readonly over: readonly Phaser.GameObjects.GameObject[];
  readonly sub = LICK.tongue.strip.sub;

  constructor(scene: Phaser.Scene) {
    bakeStripTextures(scene);
    this.outline = new StripRope(scene, STRIP_TEXTURES.outline, solidUvs());
    this.trunk = new StripRope(scene, STRIP_TEXTURES.body, bodyUvs());
    this.tip = new StripRope(scene, STRIP_TEXTURES.body, tipUvs());
    this.under = [this.outline, this.trunk];
    this.over = [this.tip];
  }

  lay(r: Ribbon): void {
    const { outline } = LICK.tongue;
    writeCapRows(r, outline, this.outline.vertices, 0);
    writeTrunkRows(r, outline, this.outline.vertices, CAP_ROWS);
    writeTipRows(r, outline, this.outline.vertices, CAP_ROWS + TRUNK_ROWS);
    // The first sample twice: the root picture ends there and the body picture begins.
    writeCapRows(r, 0, this.trunk.vertices, 0);
    writeRow(r, 0, 0, this.trunk.vertices, CAP_ROWS);
    writeTrunkRows(r, 0, this.trunk.vertices, CAP_ROWS + 1);
    writeRow(r, r.count - 1, 0, this.tip.vertices, 0);
    writeTipRows(r, 0, this.tip.vertices, 1);
    this.outline.setVisible(true);
    this.trunk.setVisible(true);
    this.tip.setVisible(true);
  }

  hide(): void {
    this.outline.setVisible(false);
    this.trunk.setVisible(false);
    this.tip.setVisible(false);
  }
}

/** The way to draw the tongue the renderer supports: strips on WebGL, redrawn Graphics on Canvas (it has no ropes). */
export function createTongueParts(scene: Phaser.Scene): TongueParts {
  return scene.game.renderer.type === Phaser.CANVAS
    ? new GraphicsTongue(scene)
    : new StripTongue(scene);
}
