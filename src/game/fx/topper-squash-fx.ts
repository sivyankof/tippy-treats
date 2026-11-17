import * as Phaser from 'phaser';
import type { TowerState } from '../../core/tower-sim';
import { Rng } from '../../core/rng';
import { PLAIN_TOPPERS, type TopperKind } from '../../data/plain-toppers';
import {
  crushedLifeMs,
  SQUASH_PICTURES,
  SQUASH_TEXTURES,
  TOPPER_SQUASH,
  type SquashBurst,
  type SquashFlatten,
} from '../../data/topper-squash';
import { clamp01, lerp } from '../../util/math';
import { DEPTH } from '../depth';
import { effectsMode } from '../effects-mode';
import type { CutSide } from '../../core/drop';
import { plainDripColumns } from '../objects/glaze-drip-layer';
import { glazeWave } from '../objects/glaze-wave';
import { artWidth } from '../objects/layer-art';
import { layerBox } from '../objects/layer-draw';
import { layerMarks } from '../objects/layer-marks';
import type { LayerMark } from '../objects/layer-mark-store';
import { plainLooks, lookOfCode } from '../objects/plain-look';
import { type TopperWorld } from '../objects/layer-topper';
import type { TowerView } from '../objects/tower-view';
import { topperSize } from '../objects/topper-look';
import { effectCues } from './effect-cues';
import { easeFn } from './ease';
import { faceHalfSpan } from './glaze-growth';
import type { Particles } from './particles';
import { rollOrigin, rollPictureSize, stainOrigin, stainPictureSize } from './squash-textures';
import { ensureTopperTexture } from './topper-texture';
import {
  burstCount,
  burstStates,
  launchX,
  rollSpots,
  squashLevelPlan,
  stainSpot,
  type StainSpot,
} from './topper-squash-plan';

/** One squashed topper lying between the two layers. */
interface Crushed {
  image: Phaser.GameObjects.Image;
  active: boolean;
  ageMs: number;
  look: SquashFlatten;
  /** The lower layer it lies on, and where it lies from that layer's centre (so it rides the sway). */
  index: number;
  offX: number;
  offY: number;
  /** Scale and tilt at the impact, and how far it sinks to lie below the seam. */
  rotation: number;
  scaleX: number;
  scaleY: number;
  sinkPx: number;
  /** The depth it passes to, between the two layers. */
  tuckDepth: number;
  ease: (t: number) => number;
}

/** What waits for the new layer's view, which exists only after the tower is synced. */
interface Pending {
  index: number;
  dipDx: number | null;
  squintMs: number;
}

/**
 * What a layer landing on a big topper does to it (docs/06, section 4, "Придавливание
 * украшений"): the squeezed topper lies between the two layers and fades, the juice, leaves,
 * halves and crumbs fly, a stain stays on the layer below, the upper layer dips. Everything
 * is baked pictures (the stain and the cream roll are marks of the layer). The effect level
 * decides what plays; `minimal` plays nothing, the topper just disappears under the layer.
 */
export class TopperSquashFx {
  private readonly crushed: Crushed[] = [];
  private pending: Pending | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tower: TowerView,
    private readonly particles: Particles,
  ) {}

  /**
   * The new layer (`state.layers.length - 1`) landed on the topper `world` of the layer under it
   * and covers its whole body: it is squeezed. Call it before the tower is synced.
   */
  hit(kind: TopperKind, world: Readonly<TopperWorld>, state: Readonly<TowerState>): void {
    const lowerIndex = state.layers.length - 2;
    const lowerView = this.tower.viewAt(lowerIndex);
    const lower = state.layers[lowerIndex];
    const layer = state.layers[lowerIndex + 1];
    if (!lowerView || !lower || !layer) return;
    const plan = squashLevelPlan(effectsMode.level);
    if (!plan.play) return;
    const look = TOPPER_SQUASH.kinds[kind];
    const rng = this.rngFor(lowerIndex + 2);
    const local = world.x - lowerView.x;
    // The juice and the rest come out of the seam at the side of the new layer, between the two layers.
    const topperX = lower.x + local;
    const side = topperX < layer.x ? -1 : 1;
    effectCues.emit({ kind: 'topperSquash', topper: kind });
    if (look.flatten) this.flatten(kind, world, lowerIndex, look.flatten);
    const seamY = world.y - PLAIN_TOPPERS.sinkPx + TOPPER_SQUASH.burstBelowSeamPx;
    const x =
      lowerView.x +
      launchX(topperX, layer.x, layer.width, faceHalfSpan(layer.width, null)) -
      lower.x;
    const depth = DEPTH.tower + (lowerIndex + 0.5) * DEPTH.towerLayerStep;
    if (kind === 'wafer') this.waferHalves(x, seamY, world.scaleX, side, rng, depth);
    else if (look.burst && look.burstTexture) {
      this.burst(look.burst, look.burstTexture, x, seamY, side, rng, depth);
    }
    for (const extra of look.extras)
      this.burst(extra.burst, extra.texture, x, seamY, side, rng, depth);
    if (plan.trace && look.stainTexture !== null) {
      this.leaveStain(lowerIndex, lower.width, local, look.stainTexture);
    }
    this.pending = {
      index: lowerIndex + 1,
      dipDx: plan.dip ? local + lower.x - layer.x : null,
      squintMs: look.squintMs,
    };
    if (look.squintMs > 0) lowerView.faceView.react(TOPPER_SQUASH.squintReaction, look.squintMs);
  }

  /** The new layer landed on a layer with a cream swirl: the cream is squeezed out at both ends of the seam. */
  cream(state: Readonly<TowerState>): void {
    const lowerIndex = state.layers.length - 2;
    const lower = state.layers[lowerIndex];
    const layer = state.layers[lowerIndex + 1];
    if (!lower || !layer || lower.kind !== 'plain') return;
    if (lookOfCode(plainLooks.codeFor(lowerIndex + 1)).decor !== 'cream') return;
    const plan = squashLevelPlan(effectsMode.level);
    if (!plan.play || !plan.trace) return;
    const spots = rollSpots(lower.x, lower.width, layer.x, layer.width);
    if (!spots) return;
    const { roll } = TOPPER_SQUASH;
    const [width, height] = rollPictureSize();
    const [originX, originY] = rollOrigin();
    const now = this.scene.time.now;
    const marks: LayerMark[] = spots.map((spot) => ({
      texture: SQUASH_TEXTURES.creamRoll,
      dx: spot.dx,
      dy: spot.dy,
      originX,
      originY,
      width,
      height,
      flipX: spot.side < 0,
      angleDeg: spot.angleDeg,
      bornMs: now + roll.delayMs,
      growMs: roll.growMs,
      clearOfShadow: true,
    }));
    if (!layerMarks.addPress(lowerIndex + 1, marks)) return;
    effectCues.emit({ kind: 'topperSquash', topper: 'cream' });
  }

  /** After the tower synced: the new layer dips where the topper was and squints. */
  afterSync(): void {
    const pending = this.pending;
    this.pending = null;
    if (!pending) return;
    const view = this.tower.viewAt(pending.index);
    if (!view) return;
    if (pending.dipDx !== null) view.playPress(pending.dipDx, TOPPER_SQUASH.press);
    if (pending.squintMs > 0) view.faceView.react(TOPPER_SQUASH.squintReaction, pending.squintMs);
  }

  update(dtMs: number): void {
    for (const c of this.crushed) {
      if (!c.active) continue;
      c.ageMs += dtMs;
      if (c.ageMs >= crushedLifeMs(c.look)) {
        c.active = false;
        c.image.setVisible(false);
        continue;
      }
      this.pose(c);
    }
  }

  private rngFor(layerNumber: number): Rng {
    return new Rng(plainLooks.cosmeticSeed).fork(`${TOPPER_SQUASH.stream}:${layerNumber}`);
  }

  private flatten(
    kind: TopperKind,
    world: Readonly<TopperWorld>,
    lowerIndex: number,
    look: SquashFlatten,
  ): void {
    const view = this.tower.viewAt(lowerIndex);
    if (!view) return;
    const size = topperSize(kind);
    const c = this.take();
    c.look = look;
    c.index = lowerIndex;
    c.offX = world.x - view.x;
    c.offY = world.y - view.y;
    c.rotation = world.rotation;
    c.scaleX = world.scaleX;
    c.scaleY = world.scaleY;
    // It is squeezed so that only a thin splat of `peekPx` shows below the seam, under the new layer.
    c.sinkPx = look.peekPx - PLAIN_TOPPERS.sinkPx;
    c.tuckDepth = DEPTH.tower + (lowerIndex + 0.5) * DEPTH.towerLayerStep;
    c.ease = easeFn(look.ease);
    c.ageMs = 0;
    c.active = true;
    c.image
      .setTexture(ensureTopperTexture(this.scene, kind))
      .setOrigin(size.originX, size.restY / size.height)
      .setRotation(world.rotation)
      .setDepth(c.tuckDepth)
      .setAlpha(1)
      .setVisible(true);
    this.pose(c);
  }

  private pose(c: Crushed): void {
    const { look } = c;
    const view = this.tower.viewAt(c.index);
    const squash = c.ease(clamp01(c.ageMs / look.squashMs));
    const fade = clamp01((c.ageMs - look.squashMs - look.holdMs) / look.fadeMs);
    // It sinks with the squash and slides a little further while it fades.
    const sink = c.sinkPx * clamp01(squash * TOPPER_SQUASH.sinkRamp) + look.sinkPx * fade;
    if (view) c.image.setPosition(view.x + c.offX, view.y + c.offY + sink);
    c.image
      .setScale(c.scaleX * lerp(1, look.scaleX, squash), c.scaleY * lerp(1, look.scaleY, squash))
      .setRotation(c.rotation * (1 - squash))
      .setAlpha(1 - fade);
  }

  private take(): Crushed {
    const free = this.crushed.find((c) => !c.active);
    if (free) return free;
    if (this.crushed.length < TOPPER_SQUASH.maxCrushed) {
      const image = this.scene.add.image(0, 0, '__DEFAULT').setVisible(false);
      const c: Crushed = {
        image,
        active: false,
        ageMs: 0,
        look: TOPPER_SQUASH.kinds.cherry.flatten,
        index: 0,
        offX: 0,
        offY: 0,
        rotation: 0,
        scaleX: 1,
        scaleY: 1,
        sinkPx: 0,
        tuckDepth: DEPTH.tower,
        ease: easeFn('Linear'),
      };
      this.crushed.push(c);
      return c;
    }
    return this.crushed.reduce((a, b) => (a.ageMs >= b.ageMs ? a : b));
  }

  /** A burst of small pictures from (`x`, `y`) towards `side`. */
  private burst(
    burst: SquashBurst,
    texture: string,
    x: number,
    y: number,
    side: -1 | 1,
    rng: Rng,
    depth: number,
  ): void {
    const count = burstCount(burst, rng);
    const tints = burst.tints.length > 0 ? burst.tints : [0xffffff];
    const shown =
      texture === SQUASH_TEXTURES.leaf
        ? SQUASH_PICTURES.leafSize.shownScale / SQUASH_PICTURES.bake
        : 1;
    this.particles.emit(
      count,
      (n) =>
        burstStates(burst, n, x, y, side, rng).map((p) => {
          p.scaleFrom *= shown;
          return p;
        }),
      { texture, tints, depth },
    );
  }

  /** The wafer breaks: the two halves start exactly where the whole wafer stood and fly apart, and crumbs fly. */
  private waferHalves(
    x: number,
    y: number,
    scale: number,
    side: -1 | 1,
    rng: Rng,
    depth: number,
  ): void {
    const burst = TOPPER_SQUASH.kinds.wafer.burst;
    if (!burst) return;
    const halves = [
      { texture: SQUASH_TEXTURES.waferTop, lift: TOPPER_SQUASH.wafer.topLiftDeg, spin: -1 },
      { texture: SQUASH_TEXTURES.waferBottom, lift: TOPPER_SQUASH.wafer.bottomLiftDeg, spin: 1 },
    ] as const;
    for (const half of halves) {
      const spec: SquashBurst = { ...burst, liftDeg: half.lift };
      this.particles.emit(
        1,
        (n) =>
          burstStates(spec, n, x, y, side, rng).map((p) => {
            p.scaleFrom = scale;
            p.scaleTo = 1;
            p.spin = Math.abs(p.spin) * half.spin * side;
            return p;
          }),
        { texture: half.texture, tints: [0xffffff], depth },
      );
    }
  }

  private leaveStain(lowerIndex: number, width: number, topperDx: number, texture: string): void {
    const spot = layerStainSpot(
      width,
      this.tower.layerPose(lowerIndex)?.cut ?? null,
      lowerIndex,
      topperDx,
    );
    if (!spot) return;
    const { stain } = TOPPER_SQUASH;
    const [pictureWidth, pictureHeight] = stainPictureSize();
    const [originX, originY] = stainOrigin();
    const made = layerMarks.addPress(lowerIndex + 1, [
      {
        texture,
        dx: spot.dx,
        dy: spot.dy,
        originX,
        originY,
        width: pictureWidth,
        height: pictureHeight,
        angleDeg: spot.angleDeg,
        bornMs: this.scene.time.now + stain.delayMs,
        growMs: stain.growMs,
      },
    ]);
    // The lower layer licks the stain off about a second later (or it melts).
    if (made) this.tower.licks.queueJuice(lowerIndex);
  }
}

/**
 * Where a juice stain sits on the plain layer of 0-based `index` (`width` wide, bitten on `cut`):
 * `stainSpot` with that layer's glaze edge and growing drips, as its picture draws them.
 */
export function layerStainSpot(
  width: number,
  cut: CutSide | null,
  index: number,
  topperDx: number,
): StainSpot | null {
  const drawn = artWidth(width);
  const face = faceHalfSpan(drawn, null);
  const wave = glazeWave(layerBox(drawn), cut, face);
  const drips = plainDripColumns(drawn, cut, index);
  return stainSpot(drawn, face, topperDx, wave, drips.xs, drips.half);
}
