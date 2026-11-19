import * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import { hasNewLook } from '../../core/mastery';
import type { PlacedLayer } from '../../core/tower-sim';
import { ANIM } from '../../data/common/anim';
import { nextUnbaked } from './collapse-scan';
import { dripTexturesFor } from './glaze-drip-layer';
import {
  acquireLayerArt,
  cakeColorsFor,
  creatureOfLayer,
  creatureStage,
  layerArtBaked,
  lookCodeFor,
  releaseLayerArt,
} from './layer-art';

/** What the picture of a placed layer is made from, as `TowerView.sync` shows it. */
function specOf(layer: PlacedLayer, index: number) {
  const golden = layer.kind === 'golden';
  return {
    look: lookCodeFor(index + 1, golden),
    creature: creatureOfLayer(layer),
    stage: creatureStage(creatureOfLayer(layer), hasNewLook(layer.level ?? 0), index + 1),
    golden,
  };
}

/**
 * Bakes the pictures of the layers the collapse will wake, ahead of it. A tall tower only keeps
 * the pictures of its top layers, so when it falls apart (and the camera runs down it) each layer
 * below the live ones would be baked in the frame that wakes it, and a slow frame wakes many at
 * once. While the run is ending (the "Continue?" window, the wait before the collapse) and during
 * the collapse this bakes one missing picture per frame, nearest layer first, never more than
 * `ANIM.pool.collapsePrepTextures` ahead of the live layers. Each picture baked here is held (one
 * user of its texture) until its layer goes live, so the idle limit cannot take it back.
 */
export class CollapsePrep {
  /** The held picture of each layer baked here that no live layer has taken yet. */
  private readonly ahead = new Map<number, string>();
  /** Every layer from here up is known to have its picture: the scan goes on below it. */
  private scanFrom = Infinity;
  private armed = false;

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stop());
  }

  /**
   * One frame of the run's end: `count` layers are drawn, the top `maxLiveLayers` of them live.
   * `cuts` holds the bitten edge of each layer (0-based).
   */
  tick(layers: readonly PlacedLayer[], cuts: ReadonlyArray<CutSide | null>, count: number): void {
    this.armed = true;
    const floor = Math.max(0, count - ANIM.pool.maxLiveLayers);
    for (const [index, key] of this.ahead) {
      if (index < floor) continue;
      releaseLayerArt(this.scene, key);
      this.ahead.delete(index);
    }
    if (this.ahead.size >= ANIM.pool.collapsePrepTextures) return;
    this.scanFrom = Math.min(this.scanFrom, floor);
    const next = nextUnbaked(this.scanFrom, (i) => {
      const layer = layers[i];
      if (!layer) return true;
      const { look, creature, stage } = specOf(layer, i);
      return layerArtBaked(this.scene, look, layer.width, cuts[i] ?? null, creature, stage);
    });
    this.scanFrom = Math.max(0, next);
    const layer = layers[next];
    if (!layer) return;
    const { look, creature, stage, golden } = specOf(layer, next);
    this.ahead.set(
      next,
      acquireLayerArt(this.scene, look, layer.width, cuts[next] ?? null, creature, false, stage),
    );
    dripTexturesFor(this.scene, creature, cakeColorsFor(creature, next + 1, golden).glaze);
  }

  /** The run goes on (or is over for good): nothing is held or baked ahead any more. */
  stop(): void {
    if (!this.armed) return;
    this.armed = false;
    this.scanFrom = Infinity;
    for (const key of this.ahead.values()) releaseLayerArt(this.scene, key);
    this.ahead.clear();
  }
}
