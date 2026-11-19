import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import type { CreatureId } from '../../data/creatures/creatures';
import type { CreatureStage } from '../../data/creatures/mastery-look';
import { acquireLayerArt, artAlpha, artOriginY, releaseLayerArt } from './layer-art';

/**
 * The baked picture of one layer view: which shared texture it holds and what it was drawn
 * for. A new texture is taken (and the old one given back) only for a new combination of
 * plain look, width, cut side, creature and stage (usual or grown look).
 */
export class LayerArtSlot {
  private key: string | null = null;
  private look = -1;
  private width = -1;
  private cut: CutSide | null = null;
  private creature: CreatureId | null = null;
  private faceless = false;
  private stage: CreatureStage = 'base';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly image: Phaser.GameObjects.Image,
  ) {}

  /** Width the picture was baked for; -1 while the slot holds none. */
  get drawnWidth(): number {
    return this.width;
  }

  /** Bitten edge of the picture shown; `null` for an intact layer or none. */
  get drawnCut(): CutSide | null {
    return this.cut;
  }

  /** Shows the picture for this combination; true when it changed (the face then needs a new layout). */
  show(
    look: number,
    width: number,
    cut: CutSide | null,
    creature: CreatureId | null,
    faceless = false,
    stage: CreatureStage = 'base',
  ): boolean {
    if (
      look === this.look &&
      faceless === this.faceless &&
      stage === this.stage &&
      width === this.width &&
      cut === this.cut &&
      creature === this.creature
    ) {
      return false;
    }
    const key = acquireLayerArt(this.scene, look, width, cut, creature, faceless, stage);
    if (this.key) releaseLayerArt(this.scene, this.key);
    this.key = key;
    this.look = look;
    this.width = width;
    this.cut = cut;
    this.creature = creature;
    this.faceless = faceless;
    this.stage = stage;
    this.image
      .setTexture(key)
      .setOrigin(0.5, artOriginY(creature, stage))
      .setAlpha(artAlpha(creature));
    this.image.setVisible(true);
    return true;
  }

  /** Gives the texture back so a pooled view does not keep it alive; `show` brings it back. `forGood`: see `releaseLayerArt`. */
  release(forGood = false): void {
    if (this.key) releaseLayerArt(this.scene, this.key, forGood);
    this.key = null;
    this.look = -1;
    this.width = -1;
    this.cut = null;
    this.creature = null;
    this.faceless = false;
    this.stage = 'base';
    this.image.setVisible(false);
  }
}
