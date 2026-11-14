import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import type { CreatureId } from '../../data/creatures';
import { acquireLayerArt, artAlpha, artOriginY, releaseLayerArt } from './layer-art';

/**
 * The baked picture of one layer view: which shared texture it holds and what it was drawn
 * for. A new texture is taken (and the old one given back) only for a new combination of
 * colour, width, cut side and creature.
 */
export class LayerArtSlot {
  private key: string | null = null;
  private color = -1;
  private width = -1;
  private cut: CutSide | null = null;
  private creature: CreatureId | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly image: Phaser.GameObjects.Image,
  ) {}

  /** Width the picture was baked for; -1 while the slot holds none. */
  get drawnWidth(): number {
    return this.width;
  }

  /** Shows the picture for this combination; true when it changed (the face then needs a new layout). */
  show(color: number, width: number, cut: CutSide | null, creature: CreatureId | null): boolean {
    if (
      color === this.color &&
      width === this.width &&
      cut === this.cut &&
      creature === this.creature
    ) {
      return false;
    }
    const key = acquireLayerArt(this.scene, color, width, cut, creature);
    if (this.key) releaseLayerArt(this.scene, this.key);
    this.key = key;
    this.color = color;
    this.width = width;
    this.cut = cut;
    this.creature = creature;
    this.image.setTexture(key).setOrigin(0.5, artOriginY(creature)).setAlpha(artAlpha(creature));
    this.image.setVisible(true);
    return true;
  }

  /** Gives the texture back so a pooled view does not keep it alive; `show` brings it back. */
  release(): void {
    if (this.key) releaseLayerArt(this.scene, this.key);
    this.key = null;
    this.color = -1;
    this.width = -1;
    this.cut = null;
    this.creature = null;
    this.image.setVisible(false);
  }
}
