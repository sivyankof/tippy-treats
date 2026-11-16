import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import type { PlacedLayer } from '../../core/tower-sim';
import { ANIM } from '../../data/anim';
import type { CreatureId } from '../../data/creatures';
import { nextUnbaked } from './collapse-scan';
import { dripTexturesFor } from './glaze-drip-layer';
import {
  cakeColorsFor,
  layerArtBaked,
  lookCodeFor,
  prepareLayerArt,
  setIdleLayerArtExtra,
} from './layer-art';

/** What the picture of a placed layer is made from, as `TowerView.sync` shows it. */
interface ArtSpec {
  look: number;
  creature: CreatureId | null;
  golden: boolean;
}

function specOf(layer: PlacedLayer, index: number): ArtSpec {
  const golden = layer.kind === 'golden';
  return {
    look: lookCodeFor(index + 1, golden),
    creature: layer.kind === 'creature' && layer.creature ? layer.creature : null,
    golden,
  };
}

/**
 * Bakes the pictures of the layers the collapse will wake, ahead of it. A tall tower only keeps
 * the pictures of its top layers, so when it falls apart (and the camera runs down it) each layer
 * below the live ones would be baked in the frame that wakes it, and a slow frame wakes many at
 * once. While the run is ending (the "Continue?" window, the wait before the collapse) and during
 * the collapse this bakes one missing picture per frame, nearest layer first, never more than
 * `ANIM.pool.collapsePrepTextures` ahead of the live layers: that many idle pictures are allowed
 * on top of the idle limit until the collapse takes them.
 */
export class CollapsePrep {
  /** Layers whose picture was baked here and no live layer has taken yet. */
  private readonly ahead = new Set<number>();
  private armed = false;

  constructor(private readonly scene: Phaser.Scene) {
    setIdleLayerArtExtra(0);
  }

  /**
   * One frame of the run's end: `count` layers are drawn, the top `maxLiveLayers` of them live.
   * `cuts` holds the bitten edge of each layer (0-based).
   */
  tick(layers: readonly PlacedLayer[], cuts: ReadonlyArray<CutSide | null>, count: number): void {
    this.armed = true;
    const floor = Math.max(0, count - ANIM.pool.maxLiveLayers);
    for (const index of this.ahead) {
      if (index >= floor) this.ahead.delete(index);
    }
    setIdleLayerArtExtra(this.ahead.size);
    if (this.ahead.size >= ANIM.pool.collapsePrepTextures) return;
    const next = nextUnbaked(floor, (i) => {
      const layer = layers[i];
      if (!layer) return true;
      const { look, creature } = specOf(layer, i);
      return layerArtBaked(this.scene, look, layer.width, cuts[i] ?? null, creature);
    });
    const layer = layers[next];
    if (!layer) return;
    const { look, creature, golden } = specOf(layer, next);
    prepareLayerArt(this.scene, look, layer.width, cuts[next] ?? null, creature);
    dripTexturesFor(this.scene, creature, cakeColorsFor(creature, next + 1, golden).glaze);
    this.ahead.add(next);
    setIdleLayerArtExtra(this.ahead.size);
  }

  /** The run goes on (or is over for good): nothing is baked ahead and the idle limit is the plain one. */
  stop(): void {
    if (!this.armed) return;
    this.armed = false;
    this.ahead.clear();
    setIdleLayerArtExtra(0);
  }
}
