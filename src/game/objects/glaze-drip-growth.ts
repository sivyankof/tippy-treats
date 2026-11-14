import type * as Phaser from 'phaser';
import type { TowerState } from '../../core/tower-sim';
import { faceRecipe } from '../../data/creature-looks';
import { GLAZE_DRIPS } from '../../data/glaze-drips';
import { pickRange } from '../../util/math';
import { effectsMode } from '../effects-mode';
import { GlazeDropFall, type DropLanding } from '../fx/glaze-drop-fall';
import { belowSpan, DropLimiter, dropChance, type BelowSpan } from '../fx/glaze-growth';
import { dripTextures, stemOuter } from './glaze-drip-textures';
import { artWidth, cakeColorsFor } from './layer-art';
import type { LayerView } from './layer-view';

/**
 * Growth of the glaze drips of the placed layers. Remembers when each layer landed (by index, so
 * a view that is recycled and acquired again shows the drips as they are by now), sets the drips
 * of the drawn layers every frame and lets a drop fall from a grown drip now and then: it falls
 * onto the layer below and leaves a spot there that melts away.
 */
export class GlazeDripGrowth {
  /** Clock time each layer landed at; `-Infinity` for the layers that stood there from the start. */
  private landedAt: number[] = [];
  private started = false;
  private readonly limiter = new DropLimiter(GLAZE_DRIPS.drop.minIntervalMs);
  private readonly melt = new DropLimiter(GLAZE_DRIPS.frosty.minIntervalMs);
  private readonly tip = { x: 0, y: 0 };
  private readonly below: BelowSpan = { left: 0, right: 0, faceFrom: 0, faceTo: 0 };
  private readonly falls: GlazeDropFall;
  private views: ReadonlyMap<number, LayerView> = new Map();

  constructor(scene: Phaser.Scene) {
    this.falls = new GlazeDropFall(scene);
    this.falls.onLand = (landing) => this.land(landing);
  }

  /** Notes the layers of the state: a new one lands now, the ones seen at the start long ago. */
  noteLayers(count: number, nowMs: number): void {
    if (count < this.landedAt.length) this.landedAt.length = count;
    const landed = this.started ? nowMs : -Infinity;
    while (this.landedAt.length < count) this.landedAt.push(landed);
    this.started = true;
  }

  /** Advances the drips of every drawn layer, the falling drops, and maybe starts a drop. */
  tick(
    views: ReadonlyMap<number, LayerView>,
    state: Readonly<TowerState>,
    nowMs: number,
    dtMs: number,
  ): void {
    this.views = views;
    const reduced = effectsMode.reduced;
    let ready = 0;
    let thawing = 0;
    for (const [index, view] of views) {
      const layer = state.layers[index];
      if (!layer) continue;
      const creature = layer.kind === 'creature' && layer.creature ? layer.creature : null;
      const glaze = cakeColorsFor(creature, index + 1, layer.kind === 'golden').glaze;
      const drips = view.glazeDrips;
      drips.configure(creature, artWidth(layer.width), glaze, index, view.cutSide);
      const age = nowMs - (this.landedAt[index] ?? -Infinity);
      drips.grow(age, this.belowOf(state, index), reduced, dtMs);
      ready += drips.readyCount;
      if (drips.canThaw) thawing++;
    }
    this.falls.update(dtMs);
    if (reduced) return;
    const { drop, frosty } = GLAZE_DRIPS;
    if (
      ready > 0 &&
      this.limiter.ready(nowMs) &&
      Math.random() < dropChance(dtMs, drop.meanWaitMs)
    ) {
      this.letDrop(views, state, ready, nowMs);
    }
    // Meltwater keeps its own, slower time, so a thawing layer is not drowned out by the drips.
    if (
      thawing > 0 &&
      this.melt.ready(nowMs) &&
      Math.random() < dropChance(dtMs, frosty.meanWaitMs)
    ) {
      this.letMeltwater(views, state, thawing, nowMs);
    }
  }

  /** Forgets the drops' timing and the landing times (a new run). */
  reset(): void {
    this.landedAt = [];
    this.started = false;
    this.limiter.reset();
    this.melt.reset();
    this.falls.clear();
  }

  /** Every falling drop goes (the tower is collapsing). */
  clearFalls(): void {
    this.falls.clear();
  }

  private letDrop(
    views: ReadonlyMap<number, LayerView>,
    state: Readonly<TowerState>,
    ready: number,
    nowMs: number,
  ): void {
    let pick = Math.floor(Math.random() * ready);
    for (const [index, view] of views) {
      const drips = view.glazeDrips;
      if (pick >= drips.readyCount) {
        pick -= drips.readyCount;
        continue;
      }
      if (!views.get(index - 1) || !state.layers[index - 1]) return;
      // A layer whose drips seldom drop (caramel) lets this one pass.
      if (Math.random() >= drips.dropWeight) return;
      if (!drips.takeDrop(pick, this.tip)) return;
      if (this.spawnDrop(view, index, views)) this.limiter.mark(nowMs);
      return;
    }
  }

  /** A drop of meltwater leaves the bottom edge of one of the thawing layers. */
  private letMeltwater(
    views: ReadonlyMap<number, LayerView>,
    state: Readonly<TowerState>,
    thawing: number,
    nowMs: number,
  ): void {
    let pick = Math.floor(Math.random() * thawing);
    for (const [index, view] of views) {
      if (!view.glazeDrips.canThaw || pick-- > 0) continue;
      if (!views.get(index - 1) || !state.layers[index - 1]) return;
      if (!view.glazeDrips.takeMeltwater(this.tip)) return;
      if (this.spawnDrop(view, index, views)) this.melt.mark(nowMs);
      return;
    }
  }

  /** Starts the drop at `this.tip` falling from layer `index` onto the one below; false when it cannot. */
  private spawnDrop(
    view: LayerView,
    index: number,
    views: ReadonlyMap<number, LayerView>,
  ): boolean {
    const target = views.get(index - 1);
    if (!target) return false;
    const drips = view.glazeDrips;
    const set = dripTextures(view.scene, drips.glazeColor, drips.dropSize);
    const landY = target.y + pickRange(GLAZE_DRIPS.drop.landY);
    if (landY <= this.tip.y) return false;
    const { caramel, frosty } = GLAZE_DRIPS;
    const thread = drips.stringy
      ? {
          ms: caramel.threadMs,
          px: caramel.threadPx,
          width: caramel.threadWidth,
          texture: set.stem,
          textureWidth: stemOuter(drips.dropSize),
        }
      : null;
    const landing = {
      index: index - 1,
      x: this.tip.x,
      y: landY,
      spot: set.spot,
      holdMul: drips.meltwater ? frosty.spotHoldMul : 1,
    };
    this.falls.spawn(this.tip.x, this.tip.y, set.drop, landing, thread);
    return true;
  }

  /** A drop got to the layer below: a spot appears there, if the layer is still drawn. */
  private land(landing: DropLanding): void {
    const view = this.views.get(landing.index);
    if (!view || effectsMode.reduced) return;
    view.glazeDrips.addSpot(
      landing.x - view.x,
      landing.y - view.y,
      pickRange(GLAZE_DRIPS.drop.spotHoldMs) * landing.holdMul,
      landing.spot,
    );
  }

  /** The layer below as the drips of this layer see it; `null` over the tray. */
  private belowOf(state: Readonly<TowerState>, index: number): BelowSpan | null {
    const layer = state.layers[index];
    const below = state.layers[index - 1];
    if (!layer || !below) return null;
    const recipe = below.kind === 'creature' && below.creature ? faceRecipe(below.creature) : null;
    return belowSpan(below.x - layer.x, artWidth(below.width), recipe, this.below);
  }
}
