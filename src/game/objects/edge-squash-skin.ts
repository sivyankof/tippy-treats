import * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { smoothstep } from '../../util/math';
import { EDGE_SQUASH } from '../../data/edge-squash';
import {
  columnEdge,
  crownCover,
  columnShare,
  squashGlaze,
  squashMid,
  squashScale,
  squashX,
  type ColumnEdge,
  type EdgeShape,
} from './edge-squash';
import { EdgeMarks, type BodyFrame } from './edge-squash-marks';
import { bodyLookOf, type BodyLook } from './edge-squash-look';
import { EdgeSilhouette } from './edge-squash-silhouette';
import { HALF_LAYER } from './layer-art';
import { createColumnView, type Columns, type ColumnView } from './edge-squash-columns';

/**
 * Draws the art of a layer view squashed against the screen edge (`edge-squash.ts`): while a
 * squash is on, the plain art image hides and the same texture shows in its place laid on
 * columns that move and stretch (`edge-squash-columns.ts`); the face moves to the middle of the visible body and the gloss band follows the
 * squashed surface. Off, everything is back as it was.
 */
export class EdgeSquashSkin {
  private readonly view: ColumnView;
  private readonly columns: Columns;
  private readonly silhouette: EdgeSilhouette;
  private readonly marks: EdgeMarks;
  private readonly bodyFrame: BodyFrame = { pad: 0, padBottom: 0, height: 0 };
  /** Scratch for the reach of one column, so no frame allocates. */
  private readonly reach: ColumnEdge = { up: 0, down: 0 };
  private on = false;
  private artWasVisible = false;
  /** The gloss band position the tween set and the one drawn instead, to map it only once. */
  private glossRaw = 0;
  private glossDrawn = Number.NaN;

  constructor(
    scene: Phaser.Scene,
    private readonly art: Phaser.GameObjects.Image,
    private readonly face: Phaser.GameObjects.Container,
    private readonly gloss: Phaser.GameObjects.Image,
  ) {
    const columns = EDGE_SQUASH.columns.count;
    this.view = createColumnView(scene, columns);
    this.silhouette = new EdgeSilhouette(scene);
    this.marks = new EdgeMarks(scene);
    this.columns = {
      us: Float32Array.from({ length: columns }, (_, i) => columnShare(i, columns)),
      cuts: new Float32Array(columns),
      xs: new Float32Array(columns),
      tops: new Float32Array(columns),
      bottoms: new Float32Array(columns),
    };
  }

  /** What to put into the content container right above the art. */
  get parts(): Phaser.GameObjects.GameObject[] {
    return [...this.view.parts, this.silhouette.part, this.marks.part];
  }

  /**
   * Shows the art squashed by `shape`, given in units `scale` times the content's own (the
   * content may be scaled by its parents: the appear stretch, the fall, a rush squeeze).
   */
  apply(shape: Readonly<EdgeShape>, scale: number): void {
    const art = this.art;
    const { us, cuts, xs, tops, bottoms } = this.columns;
    const n = xs.length;
    const width = art.width;
    const top = -art.originY * art.height;
    const bottom = top + art.height;
    const s = scale > 0 ? scale : 1;
    const height = BALANCE.layer.height;
    const { from, full, rimPx } = EDGE_SQUASH.crownCut;
    const crown = Math.max(0, art.height * art.originY - HALF_LAYER - rimPx);
    for (let i = 0; i < n; i++) {
      const u = ((us[i] ?? 0) * width - art.originX * width) * s;
      const reach = columnEdge(shape, u, this.reach);
      xs[i] = squashX(shape, u) / s;
      const squeezed = smoothstep((from - squashScale(shape, u)) / (from - full));
      const cut = crown * Math.max(squeezed, crownCover(shape, u));
      const edge = top - reach.up * height - squashGlaze(shape, u) / s;
      bottoms[i] = bottom + reach.down * height;
      // The crown is cut off the picture (its rows) and the column starts that much lower.
      cuts[i] = cut;
      tops[i] = edge + (cut * (bottoms[i]! - edge)) / art.height;
    }
    this.view.show(art.texture.key, width, art.height, this.columns, art.alpha);
    this.silhouette.draw(shape, s, this.columns, this.frame(art), this.look(art));
    this.marks.draw(shape, s, this.columns, this.frame(art));
    if (!this.on) this.artWasVisible = art.visible;
    art.setVisible(false);
    this.face.x = (squashMid(shape) * EDGE_SQUASH.faceShare) / s;
    this.mapGloss(shape, s);
    this.on = true;
  }

  /** Where the body is in the picture: its empty rows (the pad above and below) and its height. */
  private frame(art: Phaser.GameObjects.Image): BodyFrame {
    this.bodyFrame.height = art.height;
    this.bodyFrame.pad = art.height * art.originY - HALF_LAYER;
    this.bodyFrame.padBottom = art.height * (1 - art.originY) - HALF_LAYER;
    return this.bodyFrame;
  }

  /** The colours of the body of the picture (read from it once per texture). */
  private look(art: Phaser.GameObjects.Image): Readonly<BodyLook> {
    return bodyLookOf(art.scene.textures, art.texture.key, art.width, this.frame(art));
  }

  /** Back to the plain art. */
  clear(): void {
    if (!this.on) return;
    this.on = false;
    this.view.hide();
    this.silhouette.hide();
    this.marks.hide();
    this.art.setVisible(this.artWasVisible);
    this.face.x = 0;
    if (this.gloss.x === this.glossDrawn) this.gloss.x = this.glossRaw;
    this.glossDrawn = Number.NaN;
  }

  /** The gloss band runs over the squashed surface: its tweened x is mapped like a column. */
  private mapGloss(shape: Readonly<EdgeShape>, scale: number): void {
    const band = this.gloss;
    if (!band.visible) return;
    if (band.x !== this.glossDrawn) this.glossRaw = band.x;
    this.glossDrawn = squashX(shape, this.glossRaw * scale) / scale;
    band.x = this.glossDrawn;
  }
}
