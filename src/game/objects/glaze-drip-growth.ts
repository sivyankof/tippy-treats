import type { TowerState } from '../../core/tower-sim';
import { faceRecipe } from '../../data/creature-looks';
import { GLAZE_DRIPS } from '../../data/glaze-drips';
import { effectsMode } from '../effects-mode';
import { DropLimiter, dropChance, faceExclusion, type Exclusion } from '../fx/glaze-growth';
import { artWidth, cakeColorsFor } from './layer-art';
import type { LayerView } from './layer-view';

/** Called when a drop leaves a grown drip: world position of its lower end and the glaze colour. */
export type DropHandler = (x: number, y: number, color: number) => void;

/**
 * Growth of the glaze drips of the placed layers. Remembers when each layer landed (by index, so
 * a view that is recycled and acquired again shows the drips as they are by now), sets the drips
 * of the drawn layers every frame and lets a drop fall from a grown drip now and then.
 */
export class GlazeDripGrowth {
  /** Clock time each layer landed at; `-Infinity` for the layers that stood there from the start. */
  private landedAt: number[] = [];
  private started = false;
  private readonly limiter = new DropLimiter(GLAZE_DRIPS.dropMinIntervalMs);
  private readonly tip = { x: 0, y: 0 };
  private readonly exclusion: Exclusion = { from: 0, to: 0 };
  /** Where the falling drops go; none means they do not fall. */
  onDrop: DropHandler | null = null;

  /** Notes the layers of the state: a new one lands now, the ones seen at the start long ago. */
  noteLayers(count: number, nowMs: number): void {
    if (count < this.landedAt.length) this.landedAt.length = count;
    const landed = this.started ? nowMs : -Infinity;
    while (this.landedAt.length < count) this.landedAt.push(landed);
    this.started = true;
  }

  /** Advances the drips of every drawn layer and maybe starts a drop. */
  tick(
    views: ReadonlyMap<number, LayerView>,
    state: Readonly<TowerState>,
    nowMs: number,
    dtMs: number,
  ): void {
    const reduced = effectsMode.reduced;
    let grown = 0;
    for (const [index, view] of views) {
      const layer = state.layers[index];
      if (!layer) continue;
      const creature = layer.kind === 'creature' && layer.creature ? layer.creature : null;
      const glaze = cakeColorsFor(creature, index + 1, layer.kind === 'golden').glaze;
      const drips = view.glazeDrips;
      drips.configure(creature, artWidth(layer.width), glaze, index, view.cutSide);
      if (!drips.hasDrips) continue;
      const age = nowMs - (this.landedAt[index] ?? -Infinity);
      drips.grow(age, this.exclusionBelow(state, index), reduced);
      grown += drips.grownCount;
    }
    if (reduced || grown === 0 || !this.onDrop) return;
    if (!this.limiter.ready(nowMs)) return;
    if (Math.random() >= dropChance(dtMs, GLAZE_DRIPS.dropMeanWaitMs)) return;
    this.letDrop(views, grown, nowMs, this.onDrop);
  }

  /** Forgets the drops' timing and the landing times (a new run). */
  reset(): void {
    this.landedAt = [];
    this.started = false;
    this.limiter.reset();
  }

  private letDrop(
    views: ReadonlyMap<number, LayerView>,
    grown: number,
    nowMs: number,
    onDrop: DropHandler,
  ): void {
    let pick = Math.floor(Math.random() * grown);
    for (const view of views.values()) {
      const drips = view.glazeDrips;
      if (pick >= drips.grownCount) {
        pick -= drips.grownCount;
        continue;
      }
      if (drips.grownTip(pick, this.tip)) {
        onDrop(this.tip.x, this.tip.y, drips.glazeColor);
        this.limiter.mark(nowMs);
      }
      return;
    }
  }

  /** The stretch the face of the layer below covers, in the coordinates of this layer. */
  private exclusionBelow(state: Readonly<TowerState>, index: number): Exclusion | null {
    const layer = state.layers[index];
    const below = state.layers[index - 1];
    if (!layer || !below) return null;
    const recipe = below.kind === 'creature' && below.creature ? faceRecipe(below.creature) : null;
    const ex = faceExclusion(below.x - layer.x, artWidth(below.width), recipe);
    this.exclusion.from = ex.from;
    this.exclusion.to = ex.to;
    return this.exclusion;
  }
}
