import * as Phaser from 'phaser';
import type { CutSide } from '../../core/drop';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { artRecipe, faceRecipe } from '../../data/creature-looks';
import type { CreatureId } from '../../data/creatures';
import { GLAZE_DRIPS } from '../../data/glaze-drips';
import { backOut, clamp01 } from '../../util/math';
import {
  dripCountFor,
  dripDurationMs,
  dripEndY,
  dripReachShares,
  faceClearance,
  faceHalfSpan,
  growsDrips,
  growthProgress,
  growthStyle,
  runsOntoBelow,
  thaws,
  type BelowSpan,
} from '../fx/glaze-growth';
import { CREAM_DRIPS, CREAM_DRIP_LENGTH } from './creature-art/layered';
import {
  bulbOuter,
  dripTextures,
  STEM_SLICE,
  type DripSize,
  type DripTextureSet,
} from './glaze-drip-textures';
import { glazeWave, waveDripSpots, type WaveDripSpot } from './glaze-wave';
import { chainDistance, lickedDripShare } from './lick-plan';
import { DRIP_MIN_LAYER_WIDTH, dripSpots, glazeBottomY, layerBox } from './layer-draw';

/** The baked drips of a layer. */
interface DripRecipe {
  count: number;
  length: number;
  /** Share of the layer height the glaze covers. */
  depth: number;
}

/** The baked drips of a creature layer: honey, caramel and rainbow have them, the others none. */
function dripRecipe(creature: CreatureId): DripRecipe | null {
  const art = artRecipe(creature);
  if (art.kind === 'honey') {
    return { count: art.dripCount, length: art.dripLength, depth: ANIM.layer.glazeDepth };
  }
  if (art.kind === 'caramel') {
    return { count: art.dripCount, length: art.dripLength, depth: art.capDepth };
  }
  if (art.kind === 'rainbow') {
    return { count: CREAM_DRIPS, length: CREAM_DRIP_LENGTH, depth: art.creamShare };
  }
  return null;
}

/** Size of the growing drips of a creature (honey and caramel are thicker, meltwater drops small). */
function sizeFor(creature: CreatureId | null): DripSize {
  const mul = thaws(creature) ? GLAZE_DRIPS.frosty.sizeMul : growthStyle(creature).widthMul;
  const { stem, bulb, outline } = GLAZE_DRIPS.look;
  return { stem: stem * mul, bulb: bulb * mul, outline };
}

/** A meltwater drop leaves the bottom edge this far inside a side of the layer at least. */
const THAW_SIDE_MARGIN = GLAZE_DRIPS.look.bulb;
/** Points along a drip checked against a tongue. */
const TOUCH_SAMPLES = 3;
/** Tries at finding a place for a meltwater drop clear of the face below. */
const THAW_TRIES = 6;

const LICK_SIZE: DripSize = GLAZE_DRIPS.lickLook;
/** Growth below this many pixels is not drawn. */
const MIN_LENGTH = 0.5;
/** A change of the shown length below this is not applied. */
const LENGTH_EPSILON = 0.05;
/** When a drop has just left, the round end also narrows by this share of its shrink. */
const SHRINK_WIDTH_SHARE = 0.3;
/** The round end of a drop that has just left rises by this share of its lost height. */
const SHRINK_RISE_SHARE = 0.6;
/** The splat of a landing spot starts this wide and flat and springs to its size. */
const SPLAT_FROM = { x: 1.35, y: 0.45 } as const;
/** The melting spot flattens to this share of its height. */
const MELT_FLAT = 0.35;

/**
 * Where the drips of a layer grow from, none in front of its own face. A plain (or golden) layer
 * grows them out of the low points of the tongues of its wavy glaze; honey, caramel and rainbow
 * out of their baked drips.
 */
function growthSpots(
  creature: CreatureId | null,
  width: number,
  cut: CutSide | null,
  size: DripSize,
  layerIndex: number,
): WaveDripSpot[] {
  const box = layerBox(width);
  if (width < DRIP_MIN_LAYER_WIDTH) return [];
  const half = bulbOuter(size) / 2;
  if (!creature) {
    const wave = glazeWave(box, cut, faceHalfSpan(width, null));
    const clear = faceClearance(width, null, half);
    return waveDripSpots(wave, dripCountFor(width), half, clear, layerIndex % 2 === 1);
  }
  const recipe = dripRecipe(creature);
  if (!recipe) return [];
  const clear = faceClearance(width, faceRecipe(creature), half);
  const glazeY = glazeBottomY(box, recipe.depth);
  return dripSpots(box, recipe.count, recipe.length)
    .filter((spot) => Math.abs(spot.x) >= clear)
    .map((spot) => {
      const tipY = glazeY + spot.length;
      return { x: spot.x, tipY, rootY: tipY - size.bulb / 2 };
    });
}

/** One growing drip: a stem stretched to length and a round end. */
interface DripParts {
  stem: Phaser.GameObjects.Image;
  bulb: Phaser.GameObjects.Image;
  x: number;
  /** Where the drip leaves the glaze edge, and the tongue's low point (layer-centre coordinates). */
  rootY: number;
  tipY: number;
  /** Reach of this drip as a share of the longest one of the layer. */
  share: number;
  durationMs: number;
  /** Length shown now (-1: nothing laid out yet). */
  shown: number;
  /** Grown far enough and runs onto the layer below: a drop may fall from it. */
  ready: boolean;
  /** Time since a drop left it (the round end swells back). */
  sinceDropMs: number;
  /** Time since a tongue touched it (`Infinity`: not licked, or grown back). */
  sinceLickMs: number;
}

/** A spot a falling drop left on this layer. */
interface Spot {
  image: Phaser.GameObjects.Image;
  y: number;
  ageMs: number;
  holdMs: number;
}

function put(
  image: Phaser.GameObjects.Image,
  x: number,
  y: number,
  scaleX: number,
  scaleY: number,
): void {
  image.setPosition(x, y).setScale(scaleX, scaleY).setVisible(true);
}

/**
 * The glaze drips of a layer that keep growing after it has landed, the spots left by drops that
 * fell on it and the special drip of a lick. The baked picture holds the glaze; this draws the
 * drips over it with a few small baked pictures in the glaze colour (no redrawing), so a drip
 * lengthens smoothly and sets at its full length. It sits in the content container of the layer
 * view, over the body and under the face.
 */
export class GlazeDripLayer extends Phaser.GameObjects.Container {
  private readonly parts: DripParts[] = [];
  private readonly spots: Spot[] = [];
  private spotCount = 0;
  private lickStem: Phaser.GameObjects.Image | null = null;
  private lickBulb: Phaser.GameObjects.Image | null = null;
  private lickDrop: Phaser.GameObjects.Image | null = null;
  private lickTextures: DripTextureSet | null = null;
  private lickGlaze = -1;
  private textures: DripTextureSet | null = null;
  private size: DripSize = sizeFor(null);
  private dripSpotsNow: WaveDripSpot[] = [];
  private creature: CreatureId | null = null;
  private cut: CutSide | null = null;
  private layerWidth = -1;
  private glaze = -1;
  private layerIndex = -1;
  /** Frosty thaws: a meltwater drop may leave the bottom edge now (its own schedule, not `readyCount`). */
  private thawReady = false;
  private readonly below: BelowSpan = { left: 0, right: 0, faceFrom: 0, faceTo: 0 };
  private hasBelow = false;
  /** Drips a drop may fall from now. */
  readyCount = 0;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.setVisible(false);
  }

  /** Whether this layer has drips that can grow. */
  get hasDrips(): boolean {
    return this.dripSpotsNow.length > 0;
  }

  /** Colour of the drops of this layer: its glaze, or meltwater for a thawing layer. */
  get glazeColor(): number {
    return thaws(this.creature) ? GLAZE_DRIPS.frosty.color : this.glaze;
  }

  /** The glaze colour of the layer itself. */
  get ownGlaze(): number {
    return this.glaze;
  }

  /** How often a ready drip of this layer lets a drop go, compared with the others. */
  get dropWeight(): number {
    return growthStyle(this.creature).dropWeight;
  }

  /** A thawing layer may let a meltwater drop go now. */
  get canThaw(): boolean {
    return this.thawReady;
  }

  /** Whether a drop of this layer stretches into a thread before it breaks off (caramel). */
  get stringy(): boolean {
    return this.creature === 'caramel';
  }

  /** Whether the spot a drop of this layer leaves is meltwater (it dries faster). */
  get meltwater(): boolean {
    return thaws(this.creature);
  }

  /** Lays the drips out for the layer's creature, width, bitten edge and glaze colour; cheap when nothing changed. */
  configure(
    creature: CreatureId | null,
    width: number,
    glaze: number,
    layerIndex: number,
    cut: CutSide | null = null,
  ): void {
    if (
      creature === this.creature &&
      cut === this.cut &&
      width === this.layerWidth &&
      glaze === this.glaze &&
      layerIndex === this.layerIndex
    ) {
      return;
    }
    if (layerIndex !== this.layerIndex) this.clearSpots();
    this.creature = creature;
    this.cut = cut;
    this.layerWidth = width;
    this.glaze = glaze;
    this.layerIndex = layerIndex;
    this.size = sizeFor(creature);
    this.textures = dripTextures(this.scene, glaze, this.size);
    this.thawReady = false;
    this.dripSpotsNow = growsDrips(creature)
      ? growthSpots(creature, width, cut, this.size, layerIndex)
      : [];
    const style = growthStyle(creature);
    const shares = dripReachShares(layerIndex, this.dripSpotsNow.length);
    this.dripSpotsNow.forEach((spot, i) => {
      const p = this.partsAt(i);
      p.x = spot.x;
      p.rootY = spot.rootY;
      p.tipY = spot.tipY;
      p.share = shares[i] ?? 1;
      p.durationMs = dripDurationMs(layerIndex, i, style.durationMul);
      p.shown = -1;
      p.ready = false;
      p.sinceDropMs = GLAZE_DRIPS.drop.regrowMs;
      p.sinceLickMs = Infinity;
      p.stem.setTexture(this.textures!.stem);
      p.bulb.setTexture(this.textures!.bulb);
    });
    for (let i = this.dripSpotsNow.length; i < this.parts.length; i++) {
      this.hideParts(this.parts[i]!);
    }
    this.readyCount = 0;
    this.setVisible(true);
  }

  /**
   * Sets every drip to its growth `ageMs` after landing (`frozen`: nothing grows) and ages the
   * spots. A drip runs onto the layer below only where `below` lets it (not over its face).
   */
  grow(ageMs: number, below: BelowSpan | null, frozen: boolean, dtMs: number): void {
    const style = growthStyle(this.creature);
    const half = bulbOuter(this.size) / 2;
    const { readyShare, regrowMs } = GLAZE_DRIPS.drop;
    let ready = 0;
    for (let i = 0; i < this.dripSpotsNow.length; i++) {
      const p = this.parts[i]!;
      const onto = runsOntoBelow(p.x, below, half);
      const endY = dripEndY(BALANCE.layer.height, p.tipY, p.share, style.lengthMul, !onto);
      const progress = frozen ? 0 : growthProgress(ageMs, p.durationMs);
      const licked = this.ageLick(p, dtMs);
      const length = Math.max(0, progress * (endY - p.rootY)) * lickedDripShare(p.sinceLickMs);
      const regrowing = p.sinceDropMs < regrowMs;
      if (regrowing) p.sinceDropMs += dtMs;
      p.ready = onto && progress >= readyShare && !regrowing && !licked;
      if (p.ready) ready++;
      if (!regrowing && Math.abs(length - p.shown) < LENGTH_EPSILON) continue;
      p.shown = length;
      this.layoutParts(p, length);
    }
    this.hasBelow = below !== null;
    if (below) Object.assign(this.below, below);
    this.thawReady =
      thaws(this.creature) && !frozen && below !== null && ageMs >= GLAZE_DRIPS.frosty.startMs;
    this.readyCount = ready;
    this.ageSpots(dtMs);
  }

  /** Ages the lick of a drip; whether it is still short from it. */
  private ageLick(p: DripParts, dtMs: number): boolean {
    if (p.sinceLickMs === Infinity) return false;
    p.sinceLickMs += dtMs;
    if (lickedDripShare(p.sinceLickMs) < 1) return true;
    p.sinceLickMs = Infinity;
    return false;
  }

  /**
   * A tongue lies along `points` (flat, `count` points, in face pixels of a face at (`ox`, `oy`)
   * of this layer, scaled by `scale`): every drip it comes within `reach` face pixels of starts
   * to shrink, unless it is still short from an earlier lick.
   */
  touch(
    points: readonly number[],
    count: number,
    ox: number,
    oy: number,
    scale: number,
    reach: number,
  ): void {
    for (let i = 0; i < this.dripSpotsNow.length; i++) {
      const p = this.parts[i]!;
      if (p.sinceLickMs !== Infinity || p.shown < MIN_LENGTH) continue;
      for (let k = 0; k <= TOUCH_SAMPLES; k++) {
        const y = p.rootY + (p.shown * k) / TOUCH_SAMPLES;
        if (chainDistance(points, count, (p.x - ox) / scale, (y - oy) / scale) > reach) continue;
        p.sinceLickMs = 0;
        break;
      }
    }
  }

  /**
   * Lets a drop fall from the `n`-th drip that is ready: writes the world position of its lower
   * end into `out`, and its round end shrinks and swells back. False when there is none.
   */
  takeDrop(n: number, out: { x: number; y: number }): boolean {
    let seen = 0;
    for (let i = 0; i < this.dripSpotsNow.length; i++) {
      const p = this.parts[i]!;
      if (!p.ready || seen++ !== n) continue;
      const m = p.bulb.getWorldTransformMatrix();
      out.x = m.tx;
      out.y = m.ty;
      p.sinceDropMs = 0;
      p.ready = false;
      this.readyCount--;
      return true;
    }
    return false;
  }

  /**
   * A meltwater drop leaves the bottom edge at a random place over the body of the layer below,
   * clear of its face; false when no place was found.
   */
  takeMeltwater(out: { x: number; y: number }): boolean {
    if (!this.hasBelow) return false;
    const half = bulbOuter(this.size) / 2;
    const reach = this.layerWidth / 2 - THAW_SIDE_MARGIN;
    for (let i = 0; i < THAW_TRIES; i++) {
      const x = (Math.random() * 2 - 1) * reach;
      if (!runsOntoBelow(x, this.below, half)) continue;
      const m = this.getWorldTransformMatrix();
      out.x = m.tx + x;
      out.y = m.ty + BALANCE.layer.height / 2 + half;
      return true;
    }
    return false;
  }

  /** The size of the falling drops of this layer. */
  get dropSize(): DripSize {
    return this.size;
  }

  /** A drop landed at (`x`, `y`) of this layer (layer-centre coordinates): it leaves a spot that melts later. */
  addSpot(x: number, y: number, holdMs: number, textureKey: string): void {
    let spot: Spot | undefined;
    if (this.spotCount < GLAZE_DRIPS.drop.spotsPerLayer) {
      spot = this.spots[this.spotCount];
      if (!spot) {
        const image = new Phaser.GameObjects.Image(this.scene, 0, 0, textureKey).setOrigin(0.5);
        this.addAt(image, 0);
        spot = { image, y: 0, ageMs: 0, holdMs: 0 };
        this.spots.push(spot);
      }
      this.spotCount++;
    } else {
      // The oldest goes.
      spot = this.spots.reduce((a, b) => (b.ageMs > a.ageMs ? b : a));
    }
    spot.image.setTexture(textureKey).setPosition(x, y).setAlpha(1).setVisible(true);
    spot.y = y;
    spot.ageMs = 0;
    spot.holdMs = holdMs;
    this.setVisible(true);
  }

  /**
   * The special drip of a lick: it runs from `rootY` down to `endY` at `x` (layer-centre
   * coordinates), thin, scaled with the face by `scale`, in `color`.
   */
  showLickDrip(x: number, rootY: number, endY: number, scale: number, color: number): void {
    const { stem, bulb } = this.lickParts(color);
    this.lickDrop?.setVisible(false);
    const outer = bulbOuter(LICK_SIZE) * scale;
    const length = endY - rootY;
    if (length < MIN_LENGTH) {
      stem.setVisible(false);
      bulb.setVisible(false);
      return;
    }
    const s = Math.min(1, length / outer) * scale;
    put(bulb, x, endY, s, s);
    const stemLength = length - (outer * s) / scale / 2;
    if (length >= outer && stemLength > 0) {
      put(stem, x, rootY, scale, stemLength / STEM_SLICE);
    } else {
      stem.setVisible(false);
    }
  }

  /** The drop of a lick, its bottom at (`x`, `bottomY`), squashed by `squashY` (1: round). */
  showLickDrop(
    x: number,
    bottomY: number,
    scale: number,
    squashY: number,
    color: number,
    alpha = 1,
  ): void {
    const { drop } = this.lickParts(color);
    this.lickStem?.setVisible(false);
    this.lickBulb?.setVisible(false);
    put(drop, x, bottomY, scale / Math.sqrt(squashY), scale * squashY);
    drop.setAlpha(alpha);
  }

  /** The lick drip and drop are gone. */
  hideLick(): void {
    this.lickStem?.setVisible(false);
    this.lickBulb?.setVisible(false);
    this.lickDrop?.setVisible(false);
  }

  /** Forgets the layout and hides everything (a pooled view). */
  clear(): void {
    this.creature = null;
    this.cut = null;
    this.layerWidth = -1;
    this.glaze = -1;
    this.layerIndex = -1;
    this.readyCount = 0;
    this.thawReady = false;
    this.hasBelow = false;
    this.dripSpotsNow = [];
    for (const p of this.parts) this.hideParts(p);
    this.clearSpots();
    this.hideLick();
    this.setVisible(false);
  }

  private lickParts(color: number): {
    stem: Phaser.GameObjects.Image;
    bulb: Phaser.GameObjects.Image;
    drop: Phaser.GameObjects.Image;
  } {
    const set =
      this.lickTextures && this.lickGlaze === color
        ? this.lickTextures
        : dripTextures(this.scene, color, LICK_SIZE);
    if (!this.lickStem || !this.lickBulb || !this.lickDrop) {
      const make = (key: string, originY: number) =>
        new Phaser.GameObjects.Image(this.scene, 0, 0, key).setOrigin(0.5, originY);
      this.lickStem = make(set.stem, 0);
      this.lickBulb = make(set.bulb, 1);
      this.lickDrop = make(set.drop, 1);
      this.add([this.lickStem, this.lickBulb, this.lickDrop]);
    }
    if (this.lickStem.texture.key !== set.stem) {
      this.lickStem.setTexture(set.stem);
      this.lickBulb.setTexture(set.bulb);
      this.lickDrop.setTexture(set.drop);
    }
    this.lickTextures = set;
    this.lickGlaze = color;
    return { stem: this.lickStem, bulb: this.lickBulb, drop: this.lickDrop };
  }

  private ageSpots(dtMs: number): void {
    const { spotSplatMs, spotMeltMs, spotMeltSlidePx } = GLAZE_DRIPS.drop;
    for (let i = 0; i < this.spotCount; i++) {
      const spot = this.spots[i]!;
      spot.ageMs += dtMs;
      const { image, ageMs, holdMs } = spot;
      if (ageMs < spotSplatMs) {
        const t = backOut(ageMs / spotSplatMs);
        image.setScale(
          SPLAT_FROM.x + (1 - SPLAT_FROM.x) * t,
          SPLAT_FROM.y + (1 - SPLAT_FROM.y) * t,
        );
        continue;
      }
      const melt = clamp01((ageMs - spotSplatMs - holdMs) / spotMeltMs);
      if (melt <= 0) {
        image.setScale(1);
        continue;
      }
      if (melt >= 1) {
        this.removeSpot(i--);
        continue;
      }
      image
        .setScale(1, 1 - (1 - MELT_FLAT) * melt)
        .setY(spot.y + spotMeltSlidePx * melt)
        .setAlpha(1 - melt * melt);
    }
  }

  /** Hides the spot in slot `i` and keeps the live ones at the front. */
  private removeSpot(i: number): void {
    const spot = this.spots[i]!;
    spot.image.setVisible(false);
    const last = this.spotCount - 1;
    this.spots[i] = this.spots[last]!;
    this.spots[last] = spot;
    this.spotCount--;
  }

  private clearSpots(): void {
    for (const spot of this.spots) spot.image.setVisible(false);
    this.spotCount = 0;
  }

  private layoutParts(p: DripParts, length: number): void {
    if (length < MIN_LENGTH) {
      this.hideParts(p, false);
      return;
    }
    const outer = bulbOuter(this.size);
    const { bulbShrink, regrowMs } = GLAZE_DRIPS.drop;
    const regrow = clamp01(p.sinceDropMs / regrowMs);
    const k = bulbShrink + (1 - bulbShrink) * backOut(regrow);
    const grownIn = Math.min(1, length / outer);
    const scaleY = grownIn * k;
    const scaleX = grownIn * (1 - (1 - k) * SHRINK_WIDTH_SHARE);
    const bottom = p.rootY + length - outer * (1 - k) * SHRINK_RISE_SHARE;
    put(p.bulb, p.x, bottom, scaleX, scaleY);
    const stemLength = bottom - (outer * scaleY) / 2 - p.rootY;
    if (length >= outer && stemLength > 0) {
      put(p.stem, p.x, p.rootY, 1, stemLength / STEM_SLICE);
    } else {
      p.stem.setVisible(false);
    }
  }

  private hideParts(p: DripParts, resetShown = true): void {
    p.stem.setVisible(false);
    p.bulb.setVisible(false);
    p.ready = false;
    if (resetShown) p.shown = -1;
  }

  private partsAt(i: number): DripParts {
    const existing = this.parts[i];
    if (existing) return existing;
    const set = this.textures!;
    const make = (key: string, originY: number) =>
      new Phaser.GameObjects.Image(this.scene, 0, 0, key).setOrigin(0.5, originY).setVisible(false);
    const parts: DripParts = {
      stem: make(set.stem, 0),
      bulb: make(set.bulb, 1),
      x: 0,
      rootY: 0,
      tipY: 0,
      share: 1,
      durationMs: 1,
      shown: -1,
      ready: false,
      sinceDropMs: 0,
      sinceLickMs: Infinity,
    };
    // Stems first, so a round end is never covered by the stem of its neighbour.
    this.addAt(parts.stem, this.spots.length);
    this.add(parts.bulb);
    // The lick drip stays on top of every drip.
    for (const image of [this.lickStem, this.lickBulb, this.lickDrop]) {
      if (image) this.bringToTop(image);
    }
    this.parts[i] = parts;
    return parts;
  }
}
