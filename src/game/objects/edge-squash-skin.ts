import * as Phaser from 'phaser';
import { EDGE_SQUASH } from '../../data/edge-squash';
import { squashMid, squashTall, squashX, type EdgeShape } from './edge-squash';
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
    const columns = EDGE_SQUASH.columns;
    this.view = createColumnView(scene, columns);
    this.columns = {
      xs: new Float32Array(columns),
      tops: new Float32Array(columns),
      bottoms: new Float32Array(columns),
    };
  }

  /** What to put into the content container right above the art. */
  get parts(): Phaser.GameObjects.GameObject[] {
    return this.view.parts;
  }

  /**
   * Shows the art squashed by `shape`, given in units `scale` times the content's own (the
   * content may be scaled by its parents: the appear stretch, the fall, a rush squeeze).
   */
  apply(shape: Readonly<EdgeShape>, scale: number): void {
    const art = this.art;
    const { xs, tops, bottoms } = this.columns;
    const n = xs.length;
    const width = art.width;
    const top = -art.originY * art.height;
    const bottom = top + art.height;
    const s = scale > 0 ? scale : 1;
    for (let i = 0; i < n; i++) {
      const u = ((i / (n - 1)) * width - art.originX * width) * s;
      const tall = squashTall(shape, u);
      xs[i] = squashX(shape, u) / s;
      tops[i] = HALF_LAYER + (top - HALF_LAYER) * tall;
      bottoms[i] = HALF_LAYER + (bottom - HALF_LAYER) * tall;
    }
    this.view.show(art.texture.key, width, art.height, this.columns, art.alpha);
    if (!this.on) this.artWasVisible = art.visible;
    art.setVisible(false);
    this.face.x = (squashMid(shape) * EDGE_SQUASH.faceShare) / s;
    this.mapGloss(shape, s);
    this.on = true;
  }

  /** Back to the plain art. */
  clear(): void {
    if (!this.on) return;
    this.on = false;
    this.view.hide();
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
