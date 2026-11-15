import type { FlyingLayer } from '../../core/tower-sim';
import {
  creatureMaterial,
  type CreatureMaterial,
  type MaterialBurst,
} from '../../data/creature-materials';
import type { CreatureId } from '../../data/creatures';
import { EDGE_SQUASH, type WallFeel } from '../../data/edge-squash';
import { smoothstep } from '../../util/math';
import { effectsMode } from '../effects-mode';
import {
  bounceWave,
  edgeOverflow,
  fitShape,
  flatShape,
  isSquashed,
  knockPulse,
  slideShift,
  squashTallest,
  squashMid,
  squashWidth,
  wantedDepth,
} from './edge-squash';
import { artWidth } from './layer-art';
import type { LayerView } from './layer-view';

type Side = 'left' | 'right';

/** Screen walls of the flying layer, world x. */
export interface Walls {
  left: number;
  right: number;
}

/** A hard layer knocked against a wall this frame: where, and what flies off it. */
export interface WallTouch {
  x: number;
  y: number;
  /** Direction the particles fly, away from the wall (degrees, 0 is right). */
  directionDeg: number;
  creature: CreatureId;
  knock: Readonly<Omit<MaterialBurst, 'from'>>;
}

/** Drawn body of the squashed layer: centre offset from the layer centre and width, sim units. */
export interface SquashBody {
  mid: number;
  width: number;
  /** Height of the tallest column as a multiple of the normal height (1: not squashed). */
  tall: number;
}

const RIGHT_DEG = 0;
const LEFT_DEG = 180;

/**
 * Squashes the flying layer against the screen edges (docs/06, section 4, "Удар о край
 * экрана"). The shape comes from the drawn position of the layer alone (`edge-squash.ts`), so the
 * same place gives the same shape at any frame rate; on top of it there are only the light
 * bounce at the turn and the knock of a hard material, both starting from zero. During the fall
 * the squash fades out with the fall progress, so the layer lands in its true shape.
 */
export class FlyingEdgeSquash {
  private readonly shape = flatShape();
  private feel: Readonly<WallFeel> = EDGE_SQUASH.feel.normal;
  private material: CreatureMaterial | null = null;
  private creature: CreatureId | null = null;
  /** True overflow of each side in the last frame (sim x, no picture shifts). */
  private readonly lastOver = { left: -Infinity, right: -Infinity };
  private lastDir: 1 | -1 = 1;
  /** Clocks of the bounce at the turn and of the knock at the touch, per side. */
  private readonly bounceMs = { left: Infinity, right: Infinity };
  private readonly knockMs = { left: Infinity, right: Infinity };
  private fade = 1;
  private touch: WallTouch | null = null;
  private readonly body: SquashBody = { mid: 0, width: 0, tall: 1 };

  /** A new layer: its material, no history. */
  reset(layer: Readonly<FlyingLayer>, walls: Readonly<Walls>): void {
    this.creature = (layer.kind === 'creature' && layer.creature) || null;
    this.material = this.creature ? creatureMaterial(this.creature) : null;
    this.feel = EDGE_SQUASH.feel[this.material?.wall?.feel ?? 'normal'];
    this.bounceMs.left = this.bounceMs.right = Infinity;
    this.knockMs.left = this.knockMs.right = Infinity;
    this.touch = null;
    this.lastDir = layer.dir;
    this.noteOverflow(layer, walls);
  }

  /**
   * One frame of the true layer (sim position): advances the clocks, notes a touch of a wall
   * (the knock and the face) and a turn at one (the bounce). `fallShare` is the fall progress
   * 0..1 (0 while flying). The face of `view` reacts when the squash gets deep.
   */
  step(
    layer: Readonly<FlyingLayer>,
    walls: Readonly<Walls>,
    flying: boolean,
    fallShare: number,
    dtMs: number,
    view: LayerView,
  ): void {
    this.fade = 1 - smoothstep(fallShare);
    for (const side of ['left', 'right'] as const) {
      this.bounceMs[side] += dtMs;
      this.knockMs[side] += dtMs;
    }
    const lastDir = this.lastDir;
    const turnedFrom: Side = lastDir === 1 ? 'right' : 'left';
    const pressed = this.lastOver[turnedFrom] > -EDGE_SQUASH.kneePx;
    const heading: Side = layer.dir === 1 ? 'right' : 'left';
    const was = this.lastOver[heading];
    this.noteOverflow(layer, walls);
    if (flying) {
      const over = this.lastOver[heading];
      if (was < 0 && over >= 0) this.touchWall(heading, walls, view);
      const react = EDGE_SQUASH.reactFromPx;
      const depth = wantedDepth(over, EDGE_SQUASH.kneePx, this.feel);
      const wasDepth = wantedDepth(was, EDGE_SQUASH.kneePx, this.feel);
      if (wasDepth < react && depth >= react) view.faceView.react(this.feel.face, this.feel.faceMs);
    }
    // A turn while pressed against a wall bounces off it.
    if (layer.dir !== lastDir) {
      if (pressed && !effectsMode.reduced) this.bounceMs[turnedFrom] = 0;
      this.lastDir = layer.dir;
    }
  }

  /** A hard layer knocked against the wall this frame, once; `null` otherwise. */
  takeTouch(): WallTouch | null {
    const touch = this.touch;
    this.touch = null;
    return touch;
  }

  /**
   * Draws `view` squashed for its drawn centre `x` (world; the picture may be shifted off the
   * sim position) and the layer `width` (sim units). Call it whenever the picture moved or was
   * rescaled.
   */
  draw(view: LayerView, x: number, width: number, walls: Readonly<Walls>): void {
    const viewScale = view.scaleX || 1;
    const half = (artWidth(width) / 2) * view.innerScaleX;
    const over = edgeOverflow(0, half, (walls.left - x) / viewScale, (walls.right - x) / viewScale);
    const left = this.depthOf('left', over.left);
    const right = this.depthOf('right', over.right);
    fitShape(half, left, right, this.feel, this.shape);
    this.shape.shift = slideShift(over.left, over.right, EDGE_SQUASH.kneePx, this.feel) * this.fade;
    const squashed = isSquashed(this.shape);
    view.setEdgeSquash(squashed ? this.shape : null);
    const toSim = half > 0 ? width / (half * 2) : 1;
    this.body.mid = squashed ? squashMid(this.shape) * viewScale : 0;
    this.body.width = squashed ? squashWidth(this.shape) * toSim : width;
    this.body.tall = squashTallest(this.shape);
  }

  /** The drawn body after the last `draw`. The object is reused: read it at once. */
  drawnBody(): Readonly<SquashBody> {
    return this.body;
  }

  private depthOf(side: Side, overflow: number): number {
    let depth = wantedDepth(overflow, EDGE_SQUASH.kneePx, this.feel);
    // A bounce or a knock that has started always finishes; "fewer effects" only stops new ones
    // (the clocks stay at infinity), so the depth never jumps when the mode flips.
    const { periodMs, decayMs } = EDGE_SQUASH.bounce;
    depth *= 1 + this.feel.bounce * bounceWave(this.bounceMs[side], periodMs, decayMs);
    depth += this.feel.knockPx * knockPulse(this.knockMs[side], this.feel.knockMs);
    return depth * this.fade;
  }

  private noteOverflow(layer: Readonly<FlyingLayer>, walls: Readonly<Walls>): void {
    const over = edgeOverflow(layer.x, artWidth(layer.width) / 2, walls.left, walls.right);
    this.lastOver.left = over.left;
    this.lastOver.right = over.right;
  }

  private touchWall(side: Side, walls: Readonly<Walls>, view: LayerView): void {
    if (!effectsMode.reduced) this.knockMs[side] = 0;
    const knock = this.material?.wall?.knock;
    if (!knock || !this.creature || effectsMode.reduced) return;
    this.touch = {
      x: side === 'left' ? walls.left : walls.right,
      y: view.y,
      directionDeg: side === 'left' ? RIGHT_DEG : LEFT_DEG,
      creature: this.creature,
      knock,
    };
  }
}
