import type * as Phaser from 'phaser';
import type { Rng } from '../../../core/common/rng';
import { BALANCE } from '../../../data/tower/balance';
import { CUT_LOOK, CUT_PICTURE, CUT_TEXTURES } from '../../../data/cuts/cut-look';
import { shade } from '../../../util/color';
import { clamp01, lerp, smoothstep, TWO_PI } from '../../../util/math';
import { DEPTH } from '../../common/depth';
import { layerBox } from '../../objects/tower/layer-draw';
import type { LayerView } from '../../objects/tower/layer-view';
import { StripRope } from '../../objects/glaze/strip-rope';
import {
  beadGrow,
  beadShare,
  curvePoint,
  dropLaneSpeed,
  dropTallness,
  HalfShape,
  halfUvs,
  middleThickness,
  outlineOf,
  profileThickness,
  quadUvs,
  recoilAnchorScale,
  recoilLength,
  recoilRest,
  sagControl,
  sideInset,
  snapTimeMs,
  trimHalf,
  trimmedThickness,
  writeHalf,
  writeQuad,
  type StrandTrait,
  type Vec,
} from './cut-strand-geometry';
import { beadPicture, dropPicture, ribbonPicture } from './cut-textures';

const S = CUT_LOOK.strands;
const MAX_STRANDS = S.traits.length;
const PAD = CUT_PICTURE.pad;
const HALF_HEIGHT = BALANCE.layer.height / 2;

/** A snapped half never gets shorter than this share: its direction stays known. */
const MIN_LENGTH = 0.03;
/** A bead riding a snapped half back stays this far along it (share): never on its round end. */
const RIDE_MAX = 0.6;

/** The three strips of a half: outline under, fill over, a light stripe on top. */
interface Half {
  shape: HalfShape;
  outline: StripRope;
  fill: StripRope;
  gloss: StripRope;
  /** After the snap: the free end and the control point from the anchor (the piece half's in the piece's own turn). */
  end: Vec;
  control: Vec;
  /** Thickness at the break when it snapped. */
  tip: number;
  /** Length from the anchor to the break when it snapped (px). */
  length: number;
}

/** A round body: outline, fill inside it and a light dot (quads on the disc or the drop picture). */
interface Body {
  outline: StripRope;
  fill: StripRope;
  dot: StripRope;
}

interface Bead {
  on: boolean;
  half: 0 | 1;
  start: number;
  /** Where it is: share of its half from the anchor. */
  share: number;
  size: number;
  body: Body;
}

interface Strand {
  on: boolean;
  trait: StrandTrait;
  /** Where it holds on the layer (world) and from the layer centre; on the piece (from its centre, unturned) and now (world). */
  a: Vec;
  layerOff: Vec;
  local: Vec;
  b: Vec;
  halves: [Half, Half];
  beads: [Bead, Bead];
  snapped: boolean;
}

interface Drop {
  on: boolean;
  body: Body;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  ageMs: number;
}

/** What a strand set tells its owner. */
export interface StrandHooks {
  /** A strand snapped at (x, y); `first` for the first snap of the cut, `main` for the thickest strand. */
  snapped(x: number, y: number, first: boolean, main: boolean): void;
  /** A drop of glaze came off a snapped strand and starts to fall. */
  dropped(): void;
}

/** What starts a set of strands. */
export interface StrandStart {
  /** Side of the cut: 1 when the piece went right. */
  side: 1 | -1;
  /** X of the cut edge of the layer, world. */
  edgeX: number;
  /** Writes where the centre of the layer is now (it sways); false when it is gone. */
  layerCenter: (out: Vec) => boolean;
  /** Centre y of the layer and of the piece at the start. */
  y: number;
  pieceWidth: number;
  /** Width of the layer after the cut. */
  layerWidth: number;
  /** Sideways speed of the piece (px/s): the drops take a share of it. */
  driftSpeed: number;
  glaze: number;
  /** The dark tone of the glaze edge of this layer: the outline. */
  outline: number;
}

const tmp: Vec = { x: 0, y: 0 };
const control: Vec = { x: 0, y: 0 };
const freeEnd: Vec = { x: 0, y: 0 };

/**
 * The glaze strands of one cut (docs/06, "Срезы с характером"): 2-3 thin ribbons that sag between
 * the cut edge of the layer and the piece, beads sliding down them, a snap at the thinnest point
 * one strand after another, the ends springing back into the glaze and the beads falling as drops.
 * Every ribbon is a bending strip (`Rope`) of one white picture of the shared atlas, tinted: all
 * outlines first, then all fills, then the light stripes, so the strands are one batch of strips and
 * the glaze has no seams. Nothing is redrawn; only vertices move.
 */
export class CutStrands {
  private readonly strands: Strand[] = [];
  private readonly drops: Drop[] = [];
  private readonly ropes: StripRope[] = [];
  private start: StrandStart | null = null;
  private snapCount = 0;
  /** Drops of this cut so far. */
  private dropCount = 0;
  private readonly center: Vec = { x: 0, y: 0 };
  private readonly center0: Vec = { x: 0, y: 0 };
  private readonly ribbonUv: Float32Array;
  private readonly quadUv = quadUvs();

  constructor(private readonly scene: Phaser.Scene) {
    const rib = ribbonPicture();
    this.ribbonUv = halfUvs(PAD / rib.width, (rib.width - PAD) / rib.width);
    for (let i = 0; i < MAX_STRANDS; i++) this.strands.push(this.makeStrand(S.traits[i]!));
    for (let i = 0; i < MAX_STRANDS; i++) {
      this.drops.push({
        on: false,
        body: this.body(CUT_TEXTURES.drop),
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 0,
        ageMs: 0,
      });
    }
  }

  private rope(key: string, uv: Float32Array, depth: number): StripRope {
    const rope = new StripRope(this.scene, key, uv);
    this.scene.add.existing(rope);
    rope.setDepth(depth);
    this.ropes.push(rope);
    return rope;
  }

  private body(key: string): Body {
    return {
      outline: this.rope(key, this.quadUv, DEPTH.cutGlazeOutline),
      fill: this.rope(key, this.quadUv, DEPTH.cutGlazeFill),
      dot: this.rope(CUT_TEXTURES.bead, this.quadUv, DEPTH.cutGlazeGloss),
    };
  }

  private half(): Half {
    return {
      shape: new HalfShape(),
      outline: this.rope(CUT_TEXTURES.ribbon, this.ribbonUv, DEPTH.cutGlazeOutline),
      fill: this.rope(CUT_TEXTURES.ribbon, this.ribbonUv, DEPTH.cutGlazeFill),
      gloss: this.rope(CUT_TEXTURES.ribbon, this.ribbonUv, DEPTH.cutGlazeGloss),
      end: { x: 0, y: 0 },
      control: { x: 0, y: 0 },
      tip: 0,
      length: 0,
    };
  }

  private makeStrand(trait: StrandTrait): Strand {
    const bead = (half: 0 | 1): Bead => ({
      on: false,
      half,
      start: 0,
      share: 0,
      size: 0,
      body: this.body(CUT_TEXTURES.bead),
    });
    return {
      on: false,
      trait,
      a: { x: 0, y: 0 },
      layerOff: { x: 0, y: 0 },
      local: { x: 0, y: 0 },
      b: { x: 0, y: 0 },
      halves: [this.half(), this.half()],
      beads: [bead(0), bead(1)],
      snapped: false,
    };
  }

  begin(start: StrandStart, random: Rng): void {
    this.stop();
    this.start = start;
    this.snapCount = 0;
    this.dropCount = 0;
    const light = shade(start.glaze, S.gloss.lightLift);
    const count = random.int(S.count[0], S.count[1]);
    const inset = Math.min(S.inset, start.pieceWidth * S.insetMaxShare);
    this.center0.x = 0;
    this.center0.y = start.y;
    start.layerCenter(this.center0);
    const tint = (body: { outline: StripRope; fill: StripRope }): void => {
      body.outline.setColors(start.outline);
      body.fill.setColors(start.glaze);
    };
    for (const drop of this.drops) {
      tint(drop.body);
      drop.body.dot.setColors(light);
    }
    this.strands.forEach((strand, i) => {
      strand.on = i < count;
      if (!strand.on) return;
      for (const half of strand.halves) {
        tint(half);
        half.gloss.setColors(light);
      }
      const { trait } = strand;
      // Both ends sit on the outline of the cut side, further in where the top corner rounds off.
      const layerY = lerp(S.bandTop, S.bandBottom, trait.layerBand);
      const pieceY = lerp(S.bandTop, S.bandBottom, trait.pieceBand);
      const layerIn = sideInset(layerBox(start.layerWidth).radius, inset, layerY + HALF_HEIGHT);
      const pieceIn = sideInset(layerBox(start.pieceWidth).radius, inset, pieceY + HALF_HEIGHT);
      strand.a.x = start.edgeX - start.side * layerIn;
      strand.a.y = start.y + layerY;
      strand.layerOff.x = strand.a.x - this.center0.x;
      strand.layerOff.y = strand.a.y - this.center0.y;
      strand.local.x = -start.side * (start.pieceWidth / 2 - pieceIn);
      strand.local.y = pieceY;
      strand.snapped = false;
      const second = random.next() < S.beads.secondShare;
      strand.beads.forEach((bead, b) => {
        tint(bead.body);
        bead.body.dot.setColors(light);
        bead.on = b === 0 || second;
        bead.start = S.beads.from + random.next() * S.beads.fromSpread;
        bead.share = bead.start;
        bead.size = S.beads.sizePx[b]! - i * S.beads.stepPx;
      });
    });
  }

  stop(): void {
    this.start = null;
    for (const strand of this.strands) strand.on = false;
    for (const drop of this.drops) drop.on = false;
    for (const rope of this.ropes) rope.setVisible(false);
  }

  /**
   * Poses everything `sinceMs` after the let-go of the piece (negative before it). The strands
   * hold on to `piece` and follow it.
   */
  update(sinceMs: number, dtMs: number, piece: LayerView, hooks: StrandHooks): void {
    const start = this.start;
    if (!start) return;
    // The layer sways: the anchors on it go with it.
    if (start.layerCenter(this.center)) {
      for (const strand of this.strands) {
        strand.a.x = this.center.x + strand.layerOff.x;
        strand.a.y = this.center.y + strand.layerOff.y;
      }
    }
    const cos = Math.cos(piece.rotation);
    const sin = Math.sin(piece.rotation);
    for (const strand of this.strands) {
      if (!strand.on) continue;
      // The piece half grows out of the piece's cut face, which turns with it.
      strand.halves[1].shape.faceX = -sin;
      strand.halves[1].shape.faceY = cos;
      strand.b.x = piece.x + cos * strand.local.x - sin * strand.local.y;
      strand.b.y = piece.y + sin * strand.local.x + cos * strand.local.y;
      if (sinceMs < 0) {
        this.hideStrand(strand);
        continue;
      }
      const snapAt = snapTimeMs(strand.trait);
      // A long frame can jump over the whole recoil: the snap still happens (the drop on the layer, the cue).
      if (sinceMs >= snapAt && !strand.snapped) this.snap(strand, start, piece, hooks);
      if (strand.snapped) this.poseRecoil(strand, (sinceMs - snapAt) / S.recoilMs, piece);
      else this.poseStretch(strand, sinceMs);
      this.setAlpha(strand, piece.alpha);
    }
    this.updateDrops(dtMs);
  }

  /** The path of an intact strand now: its anchors and the sagging control point (into `control`). */
  private path(strand: Strand, sinceMs: number): void {
    const amount = smoothstep(sinceMs / snapTimeMs(strand.trait));
    sagControl(strand.a, strand.b, strand.trait.sag, amount, control);
    const phase = (sinceMs / S.wobbleMs) * TWO_PI + strand.trait.breakU * S.wobblePhase;
    control.x += Math.sin(phase) * S.wobblePx * amount;
  }

  private poseStretch(strand: Strand, sinceMs: number): void {
    const { trait } = strand;
    this.path(strand, sinceMs);
    const mid = middleThickness(trait, sinceMs);
    const grow = beadGrow(sinceMs);
    const chord = Math.hypot(strand.b.x - strand.a.x, strand.b.y - strand.a.y);
    for (let h = 0; h < 2; h++) {
      const half = strand.halves[h]!;
      const bead = strand.beads[h]!;
      if (bead.on) bead.share = beadShare(sinceMs, bead.start, S.beads.to[h]!);
      const along = chord * (h === 0 ? trait.breakU : 1 - trait.breakU);
      const bump = bead.on ? S.beads.bump * bead.size * grow : 0;
      const at = bead.share;
      half.shape.capped = false;
      half.shape.sample(strand.a, control, strand.b, h === 0 ? 0 : 1, trait.breakU, (s) => {
        const d = ((s - at) * along) / S.beads.bumpPx;
        return profileThickness(s, trait.end, mid) + bump * Math.exp(-d * d);
      });
      this.writeStrips(half);
      if (bead.on) this.poseBead(bead, half.shape, bead.share, grow);
      else this.hideBody(bead.body);
    }
  }

  /** Writes the outline, fill and gloss strips of a half from its shape. */
  private writeStrips(half: Half): void {
    writeHalf(half.shape, half.outline.vertices, halfWidth, noLift);
    writeHalf(half.shape, half.fill.vertices, fillHalf, noLift);
    // The light stripe stops short of a round end.
    writeHalf(half.shape, half.gloss.vertices, glossHalf, glossLift, false);
    half.outline.setVisible(true);
    half.fill.setVisible(true);
    half.gloss.setVisible(true);
  }

  /** A bead (or what is left of it) at `share` of a half, `scale` of its size. */
  private poseBead(bead: Bead, shape: HalfShape, share: number, scale: number): void {
    const size = bead.size * scale;
    if (size < 1) {
      this.hideBody(bead.body);
      return;
    }
    shape.pointAt(share, tmp);
    this.poseBody(bead.body, tmp.x, tmp.y, size, size, BEAD_SHAPE, 0, 1);
  }

  /**
   * Places a body of outer width `w` and height `h` at (x, y), its picture's bottom pointing
   * along (dirX, dirY): the outline quad, the fill quad inside it by the outline, and the light dot.
   */
  private poseBody(
    body: Body,
    x: number,
    y: number,
    w: number,
    h: number,
    shape: PictureShape,
    dirX: number,
    dirY: number,
  ): void {
    const o = outlineOf(w);
    const sx = shape.picture.width / shape.width;
    const sy = shape.picture.height / shape.height;
    writeQuad(body.outline.vertices, x, y, w * sx, h * sy, dirX, dirY);
    const inner = (w - 2 * o) / w;
    writeQuad(body.fill.vertices, x, y, w * inner * sx, (h - 2 * o) * sy, dirX, dirY);
    const dot = (w * S.dot.size * BEAD_SHAPE.picture.width) / BEAD_SHAPE.width;
    writeQuad(body.dot.vertices, x - w * S.dot.dx, y - h * S.dot.dy, dot, dot * S.dot.flat);
    body.outline.setVisible(true);
    body.fill.setVisible(true);
    body.dot.setVisible(true);
  }

  private snap(strand: Strand, start: StrandStart, piece: LayerView, hooks: StrandHooks): void {
    strand.snapped = true;
    const { trait } = strand;
    const t = trait.breakU;
    // The path as it was at the snap, even if a long frame jumped past it.
    this.path(strand, snapTimeMs(trait));
    curvePoint(strand.a, control, strand.b, t, tmp);
    const breakX = tmp.x;
    const breakY = tmp.y;
    const cos = Math.cos(-piece.rotation);
    const sin = Math.sin(-piece.rotation);
    for (let h = 0; h < 2; h++) {
      const half = strand.halves[h]!;
      const anchor = h === 0 ? strand.a : strand.b;
      // The control point of the part of the curve from the anchor to the break (its blossom).
      const t0 = h === 0 ? 0 : 1;
      const c0 = (1 - t0) * (1 - t);
      const c1 = (1 - t0) * t + t0 * (1 - t);
      const c2 = t0 * t;
      let cx = c0 * strand.a.x + c1 * control.x + c2 * strand.b.x - anchor.x;
      let cy = c0 * strand.a.y + c1 * control.y + c2 * strand.b.y - anchor.y;
      let ex = breakX - anchor.x;
      let ey = breakY - anchor.y;
      if (h === 1) {
        // The piece half turns with the piece: kept in the piece's own turn.
        [cx, cy] = [cx * cos - cy * sin, cx * sin + cy * cos];
        [ex, ey] = [ex * cos - ey * sin, ex * sin + ey * cos];
      }
      half.control.x = cx;
      half.control.y = cy;
      half.end.x = ex;
      half.end.y = ey;
      half.length = Math.hypot(ex, ey);
      half.tip = trait.mid;
    }
    // The bead nearest the break falls as a drop; the other one rides its half back.
    const [b0, b1] = strand.beads;
    const falling = !b1.on || b0.share >= b1.share ? b0 : b1;
    if (falling.on) {
      strand.halves[falling.half].shape.pointAt(falling.share, tmp);
      if (this.spawnDrop(start, tmp.x, tmp.y, falling.size)) hooks.dropped();
      falling.on = false;
      this.hideBody(falling.body);
    }
    this.snapCount++;
    const main = trait === S.traits[0];
    hooks.snapped(breakX, breakY, this.snapCount === 1, main);
  }

  /**
   * The halves spring back to their anchors (`u` 0..1 of the recoil) along the path they had: each
   * is the same curve cut shorter, its profile kept, the free end a round cap. Then the layer half
   * shrinks into the glaze and the piece half to a small dot on the piece.
   */
  private poseRecoil(strand: Strand, u: number, piece: LayerView): void {
    const { trait } = strand;
    const k = clamp01(u);
    const cos = Math.cos(piece.rotation);
    const sin = Math.sin(piece.rotation);
    // The bead that rides a half back melts into it while the end springs back.
    const beadScale = 1 - smoothstep(k / S.recoil.springU);
    const turn = smoothstep(k / S.recoil.springU);
    const side = this.start?.side ?? 1;
    for (let h = 0; h < 2; h++) {
      const half = strand.halves[h]!;
      const bead = strand.beads[h]!;
      if (h === 0 && u >= 1) {
        this.hideHalf(half);
        this.hideBody(bead.body);
        continue;
      }
      const anchor = h === 0 ? strand.a : strand.b;
      const length = Math.max(MIN_LENGTH, recoilLength(k, recoilRest(half.length)));
      trimHalf(half.control, half.end, length, control, freeEnd);
      // The end springs back to stick straight out of its cut face (the layer's faces the piece,
      // the piece's, in its own turn, faces the layer), so the stub sits flush and round on it.
      straighten(control, freeEnd, h === 0 ? side : -side, turn);
      if (h === 1) {
        [control.x, control.y] = [
          control.x * cos - control.y * sin,
          control.x * sin + control.y * cos,
        ];
        [freeEnd.x, freeEnd.y] = [
          freeEnd.x * cos - freeEnd.y * sin,
          freeEnd.x * sin + freeEnd.y * cos,
        ];
      }
      control.x += anchor.x;
      control.y += anchor.y;
      freeEnd.x += anchor.x;
      freeEnd.y += anchor.y;
      // The layer half goes into the glaze; the piece half leaves a small dot on the piece.
      const keep = h === 0 ? 0 : S.recoil.nubPx / trait.end;
      const scale = recoilAnchorScale(k, keep);
      const end = trait.end * scale;
      const mid = half.tip * scale;
      half.shape.capped = true;
      half.shape.sample(anchor, control, freeEnd, 0, 1, (s) =>
        trimmedThickness(s, length, end, mid),
      );
      this.writeStrips(half);
      if (bead.on) {
        this.poseBead(bead, half.shape, Math.min(RIDE_MAX, bead.share / length), scale * beadScale);
      } else this.hideBody(bead.body);
    }
  }

  /** Starts a falling drop; false when every drop of the pool is busy. */
  private spawnDrop(start: StrandStart, x: number, y: number, size: number): boolean {
    const drop = this.drops.find((d) => !d.on);
    if (!drop) return false;
    const { drops } = S;
    drop.on = true;
    drop.x = x;
    drop.y = y;
    // Drops of one cut keep apart: each in its own lane.
    drop.vx = start.side * (start.driftSpeed * drops.driftShare + dropLaneSpeed(this.dropCount));
    this.dropCount++;
    drop.vy = drops.downSpeed;
    drop.size = size;
    drop.ageMs = 0;
    return true;
  }

  private updateDrops(dtMs: number): void {
    const dt = dtMs / 1000;
    const { drops } = S;
    for (const drop of this.drops) {
      if (!drop.on) continue;
      drop.ageMs += dtMs;
      if (drop.ageMs >= drops.lifeMs) {
        drop.on = false;
        this.hideBody(drop.body);
        continue;
      }
      drop.vy += drops.gravity * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      // A teardrop: its point trails against the way it goes, and it stretches with the speed.
      const speed = Math.hypot(drop.vx, drop.vy);
      const age = drop.ageMs / drops.lifeMs;
      const w = drop.size * lerp(1, drops.endScale, smoothstep(age));
      const h = w * dropTallness(drop.ageMs, speed);
      const dirX = speed > 0 ? drop.vx / speed : 0;
      const dirY = speed > 0 ? drop.vy / speed : 1;
      this.poseBody(drop.body, drop.x, drop.y, w, h, DROP_SHAPE, dirX, dirY);
      const alpha = 1 - smoothstep((age - drops.fadeFrom) / (1 - drops.fadeFrom));
      drop.body.outline.setAlpha(alpha);
      drop.body.fill.setAlpha(alpha);
      drop.body.dot.setAlpha(alpha);
    }
  }

  private setAlpha(strand: Strand, alpha: number): void {
    for (const half of strand.halves) {
      half.outline.setAlpha(alpha);
      half.fill.setAlpha(alpha);
      half.gloss.setAlpha(alpha);
    }
    for (const bead of strand.beads) {
      bead.body.outline.setAlpha(alpha);
      bead.body.fill.setAlpha(alpha);
      bead.body.dot.setAlpha(alpha);
    }
  }

  private hideHalf(half: Half): void {
    half.outline.setVisible(false);
    half.fill.setVisible(false);
    half.gloss.setVisible(false);
  }

  private hideBody(body: Body): void {
    body.outline.setVisible(false);
    body.fill.setVisible(false);
    body.dot.setVisible(false);
  }

  private hideStrand(strand: Strand): void {
    for (const half of strand.halves) this.hideHalf(half);
    for (const bead of strand.beads) this.hideBody(bead.body);
  }
}

/**
 * Turns a stub (control and end from its anchor) by `share` towards sticking straight out
 * sideways (`dir` 1 right, -1 left), keeping its length.
 */
function straighten(c: Vec, e: Vec, dir: number, share: number): void {
  if (share <= 0) return;
  const len = Math.hypot(e.x, e.y);
  e.x = lerp(e.x, dir * len, share);
  e.y = lerp(e.y, 0, share);
  c.x = lerp(c.x, (dir * len) / 2, share);
  c.y = lerp(c.y, 0, share);
}

/** A picture and the size of the shape drawn in it (the rest is its empty field). */
interface PictureShape {
  picture: { width: number; height: number };
  width: number;
  height: number;
}

const BEAD_SHAPE: PictureShape = {
  picture: beadPicture(),
  width: CUT_PICTURE.bead.size,
  height: CUT_PICTURE.bead.size,
};

const DROP_SHAPE: PictureShape = {
  picture: dropPicture(),
  width: CUT_PICTURE.drop.width,
  height: CUT_PICTURE.drop.height,
};

/** Half widths of the strips of a strand of thickness `w`: the outline (all of it), the fill and the light stripe. */
function halfWidth(w: number): number {
  return w / 2;
}

function fillHalf(w: number): number {
  return w / 2 - outlineOf(w);
}

function glossHalf(w: number): number {
  const fill = fillHalf(w);
  const show = smoothstep((2 * fill - S.gloss.minFillPx) / 2);
  return fill * S.gloss.width * show;
}

function glossLift(w: number): number {
  return fillHalf(w) * S.gloss.lift;
}

function noLift(): number {
  return 0;
}
