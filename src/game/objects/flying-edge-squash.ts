import type { FlyingLayer } from '../../core/tower-sim';
import {
  creatureMaterial,
  type CreatureMaterial,
  type MaterialBurst,
} from '../../data/creature-materials';
import type { CreatureId } from '../../data/creatures';
import type { MouthKind } from '../../data/creature-looks';
import { EDGE_SQUASH, type WallFeel } from '../../data/edge-squash';
import { lerp, smoothstep } from '../../util/math';
import { effectsMode } from '../effects-mode';
import {
  bounceWave,
  edgeOverflow,
  fitShape,
  flatShape,
  glazeSwing,
  isSquashed,
  knockPulse,
  slideShift,
  speedPower,
  squashTallest,
  squashMid,
  squashWidth,
  wantedDepth,
} from './edge-squash';
import { BUBBLE_RIBS, ribLayoutFor, type RibLayout } from './edge-squash-ribs';
import { artWidth, cakeColorsFor } from './layer-art';
import type { LayerView } from './layer-view';
import { plainLooks } from './plain-look';

/** Both walls; one array for every frame. */
const SIDES = ['left', 'right'] as const;

type Side = 'left' | 'right';

/** Screen walls of the flying layer, world x. */
export interface Walls {
  left: number;
  right: number;
}

/** A layer touched a wall this frame: where, and what flies off it (crumbs of a hard one, glaze drops of a fast one). */
export interface WallTouch {
  x: number;
  y: number;
  /** Direction the particles fly, away from the wall (degrees, 0 is right). */
  directionDeg: number;
  creature: CreatureId | null;
  /** What a hard layer knocks off, `null` for the others. */
  knock: Readonly<Omit<MaterialBurst, 'from'>> | null;
  /** Glaze drops that fly up off a fast layer: how many, how big (share of full size) and in which colour (0: none). */
  drops: number;
  dropSize: number;
  glaze: number;
}

/** Drawn body of the squashed layer: centre offset from the layer centre and width, sim units. */
export interface SquashBody {
  mid: number;
  width: number;
  /** Height of the tallest column as a multiple of the normal height (1: not squashed). */
  tall: number;
}

/** 0 at `from`, 1 at `full`, smooth between. */
function rampBetween(value: number, from: number, full: number): number {
  return smoothstep((value - from) / (full - from));
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
  /** How strong the touch is: the speed of the layer between the base and the maximum, 0..1. */
  private power = 0;
  /** The ribs of the layer and the colour of its glaze (for the drops). */
  private ribs: Readonly<RibLayout> | null = null;
  private glaze = 0;
  /** Age of the impact strokes per side, ms (infinity: none), and how strong they were at the touch. */
  private readonly hitMs = { left: Infinity, right: Infinity };
  private readonly hitGain = { left: 0, right: 0 };
  private readonly body: SquashBody = { mid: 0, width: 0, tall: 1 };

  /**
   * A new layer: its material, its ribs and no history. `number` is the 1-based place it will have
   * in the tower, which gives its glaze colour.
   */
  reset(layer: Readonly<FlyingLayer>, walls: Readonly<Walls>, number: number): void {
    this.creature = (layer.kind === 'creature' && layer.creature) || null;
    this.material = this.creature ? creatureMaterial(this.creature) : null;
    this.feel = EDGE_SQUASH.feel[this.material?.wall?.feel ?? 'normal'];
    this.power = speedPower(layer.speed);
    this.ribs = this.feel.bubble ? BUBBLE_RIBS : ribLayoutFor(plainLooks.cosmeticSeed, layer.index);
    this.glaze = cakeColorsFor(this.creature, number, layer.kind === 'golden').glaze;
    this.bounceMs.left = this.bounceMs.right = Infinity;
    this.knockMs.left = this.knockMs.right = Infinity;
    this.hitMs.left = this.hitMs.right = Infinity;
    this.hitGain.left = this.hitGain.right = 0;
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
    for (const side of SIDES) {
      this.bounceMs[side] += dtMs;
      this.knockMs[side] += dtMs;
      this.hitMs[side] += dtMs;
    }
    this.power = speedPower(layer.speed);
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
      const hold = wasDepth < react && depth >= react ? this.faceHold() : 0;
      if (hold > 0) view.faceView.react(this.feel.face, hold);
    }
    // A turn while pressed against a wall bounces off it.
    if (layer.dir !== lastDir) {
      if (pressed && !effectsMode.reduced) this.bounceMs[turnedFrom] = 0;
      this.lastDir = layer.dir;
    }
  }

  /**
   * The mouth of the face for the aim `hint`: a slow layer pressed against a wall keeps a calm
   * face (the worried `o` of an aim near the edge is held back), and the closer to the squint
   * the speed gets, the more the face is let to change; a squinting layer shows it. A hard layer
   * keeps its own gape.
   */
  wallMouth(hint: MouthKind): MouthKind {
    const side = this.shape.left.depth > 0 || this.shape.right.depth > 0;
    if (hint !== 'o' || !side || this.feel.face !== 'squint') return hint;
    const { from, full } = EDGE_SQUASH.byPower.squint;
    return rampBetween(this.power, from, full) < EDGE_SQUASH.byPower.squint.mouthFrom
      ? 'smile'
      : hint;
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
    fitShape(half, left, right, this.feel, this.shape, this.power, !effectsMode.reduced);
    this.shape.ribbing = !effectsMode.reduced;
    this.shape.ribs = this.ribs;
    for (const side of SIDES) {
      this.shape[side].hit = this.strokeProgress(side);
      this.shape[side].hitGain = this.hitGain[side];
    }
    const spring = EDGE_SQUASH.glazeSpring;
    for (const side of SIDES) {
      const swing = glazeSwing(this.bounceMs[side], spring.periodMs, spring.decayMs);
      this.shape[side].spring = 1 + spring.amp * swing;
    }
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

  /** How much of the splash (drops, strokes) the layer gives at this speed: 0 at `from`, 1 at `full`, smooth, none for a hard material. */
  private splash(range: Readonly<{ from: number; full: number }>): number {
    return rampBetween(this.power, range.from, range.full) * this.feel.splash;
  }

  /** How long the face holds its squint at the touch, ms: always the full time for a hard layer, growing with the speed otherwise (0: none). */
  private faceHold(): number {
    if (this.feel.face !== 'squint') return this.feel.faceMs;
    const { from, full, minShare } = EDGE_SQUASH.byPower.squint;
    const share = rampBetween(this.power, from, full);
    return share < minShare ? 0 : this.feel.faceMs * share;
  }

  /** How far the impact strokes of a side have got, 0..1 (-1: none). */
  private strokeProgress(side: Side): number {
    const age = this.hitMs[side];
    const ms = EDGE_SQUASH.strokes.ms;
    return age < ms ? age / ms : -1;
  }

  private noteOverflow(layer: Readonly<FlyingLayer>, walls: Readonly<Walls>): void {
    const over = edgeOverflow(layer.x, artWidth(layer.width) / 2, walls.left, walls.right);
    this.lastOver.left = over.left;
    this.lastOver.right = over.right;
  }

  private touchWall(side: Side, walls: Readonly<Walls>, view: LayerView): void {
    if (effectsMode.reduced) return;
    this.knockMs[side] = 0;
    const by = EDGE_SQUASH.byPower;
    const strokes = this.splash(by.strokes);
    this.hitGain[side] = strokes;
    if (strokes > 0) this.hitMs[side] = 0;
    const knock = this.material?.wall?.knock ?? null;
    const dropGain = this.splash(by.drops);
    const drops = dropGain > 0 ? Math.ceil(dropGain * by.drops.count) : 0;
    if (!knock && drops <= 0) return;
    this.touch = {
      x: side === 'left' ? walls.left : walls.right,
      y: view.y,
      directionDeg: side === 'left' ? RIGHT_DEG : LEFT_DEG,
      creature: this.creature,
      knock,
      drops,
      dropSize: lerp(by.drops.size, 1, dropGain),
      glaze: this.glaze,
    };
  }
}
