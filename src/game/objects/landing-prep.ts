import type * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import type { FlyingLayer, LandingPreview } from '../../core/sim-types';
import { collectBakeSteps, type BakeStep } from '../ui/bake-texture';
import { dripTexturesFor } from './glaze-drip-layer';
import { cakeColorsFor, lookCodeFor, prepareLayerArt } from './layer-art';

/** The bitten-off piece shows the sponge on the side that faced the tower: the opposite of the cut. */
const OPPOSITE: Readonly<Record<CutSide, CutSide>> = { left: 'right', right: 'left' };

/**
 * Makes the pictures a layer needs before it lands, one texture per frame, so the frame of the
 * landing (and of the next take-off) finds them baked: the glaze drips (known when the layer
 * takes off) and the pictures of the placed layer, of the piece bitten off it and of the plain
 * layer that flies next (known when it is dropped). Whatever is not ready in time is simply
 * baked by its first user, as before.
 */
export class LandingPrep {
  /** Bakes for the layer in the fall, replaced when the drop it was made for changes. */
  private landing: BakeStep[] = [];
  /** Bakes for the layer in the air. */
  private flight: BakeStep[] = [];
  private flightIndex = -1;
  private readonly noted: LandingPreview = {
    index: 0,
    kind: 'plain',
    creature: null,
    width: 0,
    cut: null,
    pieceWidth: 0,
  };
  private hasNoted = false;

  constructor(private readonly scene: Phaser.Scene) {}

  /**
   * The layer in the air, which will be the layer number `number` (1-based) of the tower: its drip
   * pictures are baked in the next frames. Cheap for a layer already noted.
   */
  noteFlying(layer: Readonly<FlyingLayer> | null, number: number): void {
    if (!layer) {
      this.flightIndex = -1;
      return;
    }
    if (number === this.flightIndex) return;
    this.flightIndex = number;
    const creature = layer.kind === 'creature' && layer.creature ? layer.creature : null;
    const glaze = cakeColorsFor(creature, number, layer.kind === 'golden').glaze;
    this.flight = collectBakeSteps(() => {
      dripTexturesFor(this.scene, creature, glaze);
    });
  }

  /** How the falling layer will land: its pictures are baked in the next frames. Cheap while the answer stays the same. */
  noteLanding(preview: Readonly<LandingPreview>): void {
    const n = this.noted;
    if (
      this.hasNoted &&
      n.index === preview.index &&
      n.kind === preview.kind &&
      n.creature === preview.creature &&
      n.width === preview.width &&
      n.cut === preview.cut &&
      n.pieceWidth === preview.pieceWidth
    ) {
      return;
    }
    Object.assign(n, preview);
    this.hasNoted = true;
    const { scene } = this;
    const look = lookCodeFor(preview.index, preview.kind === 'golden');
    const { creature, width, cut, pieceWidth } = preview;
    this.landing = [() => prepareLayerArt(scene, look, width, cut, creature)];
    if (pieceWidth > 0 && cut) {
      this.landing.push(() =>
        prepareLayerArt(scene, look, pieceWidth, OPPOSITE[cut], creature, true),
      );
    }
    // The next layer takes off this wide; it is a plain one unless the plan says otherwise (not known yet).
    const next = lookCodeFor(preview.index + 1, false);
    this.landing.push(() => prepareLayerArt(scene, next, width, null));
  }

  /**
   * The drop is over (landed or missed): a new one is noted from scratch. What is still waiting
   * is baked in the next frames: the pictures of the next layer are needed just after.
   */
  endLanding(): void {
    this.hasNoted = false;
  }

  /** Does the next bake, if any is waiting: one per frame. */
  tick(): void {
    const step = this.landing.shift() ?? this.flight.shift();
    step?.();
  }
}
