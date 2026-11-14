import * as Phaser from 'phaser';
import { ANIM } from '../../data/anim';
import { BALANCE } from '../../data/balance';
import { artRecipe } from '../../data/creature-looks';
import type { CreatureId } from '../../data/creatures';
import { shade } from '../../util/color';
import { FX_TEXTURES } from '../fx/fx-textures';
import {
  dripDurationMs,
  growsDrips,
  growthProgress,
  growthStyle,
  maxExtension,
  standsAside,
  type Exclusion,
} from '../fx/glaze-growth';
import { CREAM_DRIPS, CREAM_DRIP_LENGTH } from './creature-art/layered';
import {
  DRIP_WIDTH,
  GLAZE_OUTLINE,
  dripSpots,
  glazeBottomY,
  layerBox,
  type DripSpot,
} from './layer-draw';

/** The baked drips of a layer. */
interface DripRecipe {
  count: number;
  length: number;
  /** Share of the layer height the glaze covers. */
  depth: number;
}

/** The baked drips of a layer: plain ones, honey and rainbow have them, the other creatures none. */
function dripRecipe(creature: CreatureId | null): DripRecipe | null {
  if (!creature) {
    const { dripCount, dripLength, glazeDepth } = ANIM.layer;
    return { count: dripCount, length: dripLength, depth: glazeDepth };
  }
  const art = artRecipe(creature);
  if (art.kind === 'honey') {
    return { count: art.dripCount, length: art.dripLength, depth: ANIM.layer.glazeDepth };
  }
  if (art.kind === 'rainbow') {
    return { count: CREAM_DRIPS, length: CREAM_DRIP_LENGTH, depth: art.creamShare };
  }
  return null;
}

/** Phaser's built-in white texture and its edge in pixels. */
const WHITE_TEXTURE = '__WHITE';
const WHITE_SIZE = 4;
const OUTLINE_WIDTH = DRIP_WIDTH + ANIM.layer.outline;
const CAP_TEXTURE_SIZE = ANIM.fx.textures.circle;
/** Growth below this many pixels is not drawn (the baked drip shows alone). */
const MIN_EXTENSION = 0.5;
/** A change of the shown length below this is not applied. */
const EXTENSION_EPSILON = 0.05;

/** One growing drip: a stem and a round tip, each with an outline under it. */
interface DripParts {
  outlineStem: Phaser.GameObjects.Image;
  outlineCap: Phaser.GameObjects.Image;
  fillStem: Phaser.GameObjects.Image;
  fillCap: Phaser.GameObjects.Image;
  /** Centre of the baked tip's round end (layer-centre coordinates). */
  x: number;
  capY: number;
  maxExt: number;
  durationMs: number;
  /** Extension shown now (-1: nothing laid out yet). */
  shown: number;
  grown: boolean;
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
 * The part of the glaze drips of a layer that keeps growing after it has landed. The baked
 * picture holds short drips; this draws the extra length over them with a few small tinted
 * images (no redrawing), so a drip lengthens smoothly and sets at its full length.
 * It sits in the content container of the layer view, over the body and under the face.
 */
export class GlazeDripLayer extends Phaser.GameObjects.Container {
  private readonly parts: DripParts[] = [];
  private spots: DripSpot[] = [];
  private creature: CreatureId | null = null;
  private layerWidth = -1;
  private glaze = -1;
  private layerIndex = -1;
  /** Drips at their full length (candidates for a falling drop). */
  grownCount = 0;

  constructor(scene: Phaser.Scene) {
    super(scene);
    this.setVisible(false);
  }

  /** Whether this layer has drips that can grow. */
  get hasDrips(): boolean {
    return this.spots.length > 0;
  }

  /** Glaze colour of the drips (for a falling drop). */
  get glazeColor(): number {
    return this.glaze;
  }

  /** Lays the drips out for the layer's creature, width and glaze colour; cheap when nothing changed. */
  configure(creature: CreatureId | null, width: number, glaze: number, layerIndex: number): void {
    if (
      creature === this.creature &&
      width === this.layerWidth &&
      glaze === this.glaze &&
      layerIndex === this.layerIndex
    ) {
      return;
    }
    this.creature = creature;
    this.layerWidth = width;
    this.glaze = glaze;
    this.layerIndex = layerIndex;
    const recipe = growsDrips(creature) ? dripRecipe(creature) : null;
    const box = layerBox(width);
    this.spots = recipe ? dripSpots(box, recipe.count, recipe.length) : [];
    const style = growthStyle(creature);
    const glazeY = recipe ? glazeBottomY(box, recipe.depth) : 0;
    this.spots.forEach((spot, i) => {
      const p = this.partsAt(i);
      p.x = spot.x;
      p.capY = glazeY + spot.length - DRIP_WIDTH / 2;
      p.maxExt = maxExtension(BALANCE.layer.height, glazeY + spot.length, style.lengthMul);
      p.durationMs = dripDurationMs(layerIndex, i, style.durationMul);
      p.shown = -1;
      p.grown = false;
      const outline = shade(glaze, GLAZE_OUTLINE);
      p.outlineStem.setTint(outline);
      p.outlineCap.setTint(outline);
      p.fillStem.setTint(glaze);
      p.fillCap.setTint(glaze);
    });
    for (let i = this.spots.length; i < this.parts.length; i++) this.hideParts(this.parts[i]!);
    this.grownCount = 0;
    this.setVisible(this.spots.length > 0);
  }

  /**
   * Sets every drip to its growth `ageMs` after landing (`frozen`: the baked state only).
   * A drip that stands over `exclusion` (the face of the layer below) does not grow.
   */
  grow(ageMs: number, exclusion: Exclusion | null, frozen: boolean): void {
    let grown = 0;
    for (let i = 0; i < this.spots.length; i++) {
      const p = this.parts[i]!;
      const aside = standsAside(p.x, exclusion, DRIP_WIDTH / 2);
      const progress = frozen || !aside ? 0 : growthProgress(ageMs, p.durationMs);
      const ext = progress * p.maxExt;
      p.grown = progress >= 1 && p.maxExt >= MIN_EXTENSION;
      if (p.grown) grown++;
      if (Math.abs(ext - p.shown) < EXTENSION_EPSILON) continue;
      p.shown = ext;
      this.layoutParts(p, ext);
    }
    this.grownCount = grown;
  }

  /** World position of the lower end of the `n`-th fully grown drip; false when there is none. */
  grownTip(n: number, out: { x: number; y: number }): boolean {
    let seen = 0;
    for (const p of this.parts) {
      if (!p.grown || seen++ !== n) continue;
      const m = p.fillCap.getWorldTransformMatrix();
      out.x = m.tx;
      out.y = m.ty + DRIP_WIDTH / 2;
      return true;
    }
    return false;
  }

  /** Forgets the layout and hides everything (a pooled view). */
  clear(): void {
    this.creature = null;
    this.layerWidth = -1;
    this.glaze = -1;
    this.layerIndex = -1;
    this.grownCount = 0;
    this.spots = [];
    for (const p of this.parts) this.hideParts(p);
    this.setVisible(false);
  }

  private layoutParts(p: DripParts, ext: number): void {
    if (ext < MIN_EXTENSION) {
      this.hideParts(p, false);
      return;
    }
    const stemScaleY = ext / WHITE_SIZE;
    put(p.outlineStem, p.x, p.capY, OUTLINE_WIDTH / WHITE_SIZE, stemScaleY);
    put(p.fillStem, p.x, p.capY, DRIP_WIDTH / WHITE_SIZE, stemScaleY);
    const outlineCap = OUTLINE_WIDTH / CAP_TEXTURE_SIZE;
    const fillCap = DRIP_WIDTH / CAP_TEXTURE_SIZE;
    put(p.outlineCap, p.x, p.capY + ext, outlineCap, outlineCap);
    put(p.fillCap, p.x, p.capY + ext, fillCap, fillCap);
  }

  private hideParts(p: DripParts, resetShown = true): void {
    p.outlineStem.setVisible(false);
    p.outlineCap.setVisible(false);
    p.fillStem.setVisible(false);
    p.fillCap.setVisible(false);
    p.grown = false;
    if (resetShown) p.shown = -1;
  }

  private partsAt(i: number): DripParts {
    const existing = this.parts[i];
    if (existing) return existing;
    const make = (key: string, originY: number) =>
      new Phaser.GameObjects.Image(this.scene, 0, 0, key).setOrigin(0.5, originY).setVisible(false);
    // Outlines first, so every outline sits under every fill, as in the baked drips.
    const parts: DripParts = {
      outlineStem: make(WHITE_TEXTURE, 0),
      outlineCap: make(FX_TEXTURES.circle, 0.5),
      fillStem: make(WHITE_TEXTURE, 0),
      fillCap: make(FX_TEXTURES.circle, 0.5),
      x: 0,
      capY: 0,
      maxExt: 0,
      durationMs: 1,
      shown: -1,
      grown: false,
    };
    this.add([parts.outlineStem, parts.outlineCap, parts.fillStem, parts.fillCap]);
    this.parts[i] = parts;
    return parts;
  }
}
