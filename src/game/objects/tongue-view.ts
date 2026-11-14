import * as Phaser from 'phaser';
import { LICK } from '../../data/lick';
import { PALETTE } from '../../data/palette';
import { bakeTexture } from '../ui/bake-texture';
import { loopPoint, type LickScene, type LoopShape } from './lick-plan';
import { tongueOuterWidth, tongueWidthAt } from './tongue-shape';

/** Texture keys of the long tongue, its saliva drop and its wet trail. */
const TONGUE_TEXTURES = {
  /** A short slice across the ribbon (pink, light stripe, dark groove), stretched along a piece. */
  slice: 'lick_tongue_slice',
  /** The same slice in the outline colour, as wide as the ribbon with its outline. */
  sliceLine: 'lick_tongue_slice_line',
  /** A round joint between the pieces, so a bend has no gaps; and its outline. */
  joint: 'lick_tongue_joint',
  jointLine: 'lick_tongue_joint_line',
  /** The wide round tip (a spatula) with a shine, its flat side on the last piece; and its outline. */
  tip: 'lick_tongue_tip',
  tipLine: 'lick_tongue_tip_line',
  /** A drop of saliva hanging from the tip. */
  saliva: 'lick_tongue_saliva',
  /** A glossy wet blob of the trail. */
  wet: 'lick_tongue_wet',
} as const;

/**
 * The slice is drawn `SLICE_PAD` rows taller at both ends and shown through an inner frame of
 * `SLICE_HEIGHT` rows: stretched, its ends then stay solid instead of fading into the edge of the
 * texture. The ribbon is drawn in two passes, every outline piece under every fill piece, so a
 * tight bend never shows an outline across the pink.
 */
const SLICE_HEIGHT = 4;
const SLICE_PAD = 4;
const SLICE_FRAME = 'inner';
/** The wet blob is this much longer than wide, and has a brighter streak. */
const WET_STRETCH = 1.6;
const WET_RINGS = [
  { scale: 1, alpha: 0.35 },
  { scale: 0.7, alpha: 0.35 },
] as const;
const WET_SHINE = { y: 0.3, w: 0.4, h: 0.18, alpha: 0.9 } as const;
/** The shine on the tip, as shares of the tongue width. */
const TIP_SHINE = { x: -0.2, y: 0.3, w: 0.26, h: 0.2, alpha: 0.85 } as const;
/** The saliva drop: its height as a share of its width, the outline and a shine. */
const SALIVA = { tall: 1.4, outline: 2, outlineShade: 0x6fa3c6, shine: 0.3 } as const;

/** The pictures are baked at the widest tongue and scaled down along it. */
const BAKE_WIDTH = LICK.tongue.width.big.full;
const BAKE_OUTER = tongueOuterWidth('big');
/** The stripes of the tip start this far down its height. */
const TIP_STRIPES_FROM = 0.45;

/**
 * Bakes the tongue pictures once. The fills are as wide as the ribbon and the outlines as wide as
 * the ribbon with its outline, each its own picture, so a narrower piece keeps the same outline
 * while its groove and stripe narrow with it.
 */
function bakeTongue(scene: Phaser.Scene): void {
  const t = LICK.tongue;
  const w = BAKE_WIDTH;
  const outer = BAKE_OUTER;
  const outline = PALETTE.textDark;
  const white = PALETTE.textLight;
  // The light stripe and the dark groove, down the picture: centre, width, colour and alpha.
  const bands = [
    { x: w / 2 + w * t.stripeAt, width: w * t.stripeWidth, color: white, alpha: t.stripeAlpha },
    { x: w / 2, width: w * t.grooveWidth, color: t.groove, alpha: 1 },
  ] as const;
  const stripes = (g: Phaser.GameObjects.Graphics, height: number, y = 0): void => {
    for (const b of bands)
      g.fillStyle(b.color, b.alpha).fillRect(b.x - b.width / 2, y, b.width, height);
  };
  const sliceTall = SLICE_HEIGHT + SLICE_PAD * 2;
  bakeTexture(scene, TONGUE_TEXTURES.sliceLine, outer, sliceTall, (g) => {
    g.fillStyle(outline, 1).fillRect(0, 0, outer, sliceTall);
  });
  bakeTexture(scene, TONGUE_TEXTURES.slice, w, sliceTall, (g) => {
    g.fillStyle(t.fill, 1).fillRect(0, 0, w, sliceTall);
    stripes(g, sliceTall);
  });
  const slices = [
    [TONGUE_TEXTURES.slice, w],
    [TONGUE_TEXTURES.sliceLine, outer],
  ] as const;
  for (const [key, width] of slices) {
    const texture = scene.textures.get(key);
    if (!texture.has(SLICE_FRAME)) texture.add(SLICE_FRAME, 0, 0, SLICE_PAD, width, SLICE_HEIGHT);
  }
  bakeTexture(scene, TONGUE_TEXTURES.jointLine, outer, outer, (g) => {
    g.fillStyle(outline, 1).fillCircle(outer / 2, outer / 2, outer / 2);
  });
  // The joint carries the stripes too (turned along its piece), so a bend shows no gap in them.
  bakeTexture(scene, TONGUE_TEXTURES.joint, w, w, (g) => {
    const r = w / 2;
    g.fillStyle(t.fill, 1).fillCircle(r, r, r);
    for (const b of bands) {
      const half = Math.sqrt(Math.max(0, r * r - (b.x - r) * (b.x - r)));
      g.fillStyle(b.color, b.alpha).fillRect(b.x - b.width / 2, r - half, b.width, half * 2);
    }
  });
  // The tip points up in the picture: half an ellipse, its flat lower side on the end of the last piece.
  const tipH = w * t.tipShare;
  const tipOuterH = tipH + t.outline;
  bakeTexture(scene, TONGUE_TEXTURES.tipLine, outer, tipOuterH, (g) => {
    g.fillStyle(outline, 1).fillEllipse(outer / 2, tipOuterH, outer, tipOuterH * 2);
  });
  bakeTexture(scene, TONGUE_TEXTURES.tip, w, tipH, (g) => {
    g.fillStyle(t.fill, 1).fillEllipse(w / 2, tipH, w, tipH * 2);
    stripes(g, tipH * (1 - TIP_STRIPES_FROM), tipH * TIP_STRIPES_FROM);
    g.fillStyle(white, TIP_SHINE.alpha).fillEllipse(
      w / 2 + w * TIP_SHINE.x,
      tipH * TIP_SHINE.y,
      w * TIP_SHINE.w,
      w * TIP_SHINE.h,
    );
  });
  const s = LICK.saliva;
  const sh = s.size * SALIVA.tall;
  bakeTexture(scene, TONGUE_TEXTURES.saliva, s.size, sh, (g) => {
    const r = s.size / 2;
    g.fillStyle(SALIVA.outlineShade, s.alpha)
      .fillCircle(r, sh - r, r)
      .fillTriangle(r, 0, 0, sh - r, s.size, sh - r);
    const ri = r - SALIVA.outline;
    g.fillStyle(s.color, s.alpha)
      .fillCircle(r, sh - r, ri)
      .fillTriangle(r, SALIVA.outline * 2, r - ri, sh - r, r + ri, sh - r);
    g.fillStyle(white, 1).fillCircle(
      r - ri * SALIVA.shine * 1.5,
      sh - r - ri * SALIVA.shine,
      ri * SALIVA.shine,
    );
  });
  const size = LICK.trail.size;
  const long = size * WET_STRETCH;
  bakeTexture(scene, TONGUE_TEXTURES.wet, long, size, (g) => {
    for (const ring of WET_RINGS) {
      g.fillStyle(white, ring.alpha).fillEllipse(
        long / 2,
        size / 2,
        long * ring.scale,
        size * ring.scale,
      );
    }
    g.fillStyle(white, WET_SHINE.alpha).fillEllipse(
      long / 2,
      size * WET_SHINE.y,
      long * WET_SHINE.w,
      size * WET_SHINE.h,
    );
  });
}

const RAD_TO_DEG = 180 / Math.PI;
const TANGENT_STEP = 0.002;

/**
 * The long tongue of a lick, drawn over the face: a chain of baked pieces (round joints under
 * stretched slices, outlines under fills, a rounded tip on top) laid along the points of `tongueBody`, a drop of saliva
 * at the tip and the wet trail the tip leaves round the loop, drying fast. Lives in the face
 * container, in face pixels; nothing is redrawn.
 */
export class TongueView extends Phaser.GameObjects.Container {
  private readonly jointLines: Phaser.GameObjects.Image[] = [];
  private readonly sliceLines: Phaser.GameObjects.Image[] = [];
  private readonly joints: Phaser.GameObjects.Image[] = [];
  private readonly slices: Phaser.GameObjects.Image[] = [];
  private readonly tip: Phaser.GameObjects.Image;
  private readonly tipLine: Phaser.GameObjects.Image;
  private readonly saliva: Phaser.GameObjects.Image;
  private readonly wet: Phaser.GameObjects.Image[] = [];
  /** Lick time each trail blob was laid at (-1: not yet). */
  private readonly wetAt: number[] = [];
  private readonly a = { x: 0, y: 0 };
  private readonly b = { x: 0, y: 0 };

  constructor(scene: Phaser.Scene) {
    super(scene);
    bakeTongue(scene);
    const image = (key: string, originY: number, frame?: string): Phaser.GameObjects.Image =>
      new Phaser.GameObjects.Image(scene, 0, 0, key, frame)
        .setOrigin(0.5, originY)
        .setVisible(false);
    for (let i = 0; i < LICK.trail.count; i++) {
      this.wet.push(image(TONGUE_TEXTURES.wet, 0.5));
      this.wetAt.push(-1);
    }
    const n = LICK.tongue.segments;
    for (let i = 0; i < n; i++) {
      this.jointLines.push(image(TONGUE_TEXTURES.jointLine, 0.5));
      this.sliceLines.push(image(TONGUE_TEXTURES.sliceLine, 0, SLICE_FRAME));
      this.joints.push(image(TONGUE_TEXTURES.joint, 0.5));
      this.slices.push(image(TONGUE_TEXTURES.slice, 0, SLICE_FRAME));
    }
    this.tip = image(TONGUE_TEXTURES.tip, 1);
    this.tipLine = image(TONGUE_TEXTURES.tipLine, 1);
    this.saliva = image(TONGUE_TEXTURES.saliva, 0);
    // Trail under the tongue; every outline piece under every fill piece; the tip and its saliva on top.
    this.add([
      ...this.wet,
      ...this.jointLines,
      ...this.sliceLines,
      this.tipLine,
      ...this.joints,
      ...this.slices,
      this.saliva,
      this.tip,
    ]);
  }

  /**
   * Lays the tongue of `scene` along `points` (flat `[x0, y0, ...]`, from the mouth to the tip),
   * `widthMul` of its width: narrow at the root, wide from the middle to the tip.
   */
  layTongue(points: readonly number[], scene: LickScene, widthMul: number): void {
    const n = LICK.tongue.segments;
    const o = LICK.tongue.outline * 2;
    const width = (i: number): number => tongueWidthAt(scene, i / n) * widthMul;
    let angle = 0;
    for (let i = 0; i < n; i++) {
      const ax = points[i * 2]!;
      const ay = points[i * 2 + 1]!;
      const dx = points[i * 2 + 2]! - ax;
      const dy = points[i * 2 + 3]! - ay;
      const length = Math.hypot(dx, dy);
      if (length > 0) angle = Math.atan2(dx, -dy) * RAD_TO_DEG;
      const w = width(i);
      const across = (w + width(i + 1)) / 2;
      // The root has no joint: it would stick out of the mouth behind the tongue.
      this.jointLines[i]!.setPosition(ax, ay)
        .setScale((w + o) / BAKE_OUTER)
        .setVisible(i > 0);
      this.joints[i]!.setPosition(ax, ay)
        .setAngle(angle + 180)
        .setScale(w / BAKE_WIDTH)
        .setVisible(i > 0);
      // A slice hangs down from its origin in the picture: turned by 180 it points along the piece.
      const along = length / SLICE_HEIGHT;
      this.sliceLines[i]!.setPosition(ax, ay)
        .setAngle(angle + 180)
        .setScale((across + o) / BAKE_OUTER, along)
        .setVisible(length > 0);
      this.slices[i]!.setPosition(ax, ay)
        .setAngle(angle + 180)
        .setScale(across / BAKE_WIDTH, along)
        .setVisible(length > 0);
    }
    const tipW = width(n);
    const tx = points[n * 2]!;
    const ty = points[n * 2 + 1]!;
    this.tipLine
      .setPosition(tx, ty)
      .setAngle(angle)
      .setScale((tipW + o) / BAKE_OUTER)
      .setVisible(true);
    this.tip
      .setPosition(tx, ty)
      .setAngle(angle)
      .setScale(tipW / BAKE_WIDTH)
      .setVisible(true);
  }

  /** A drop of saliva hangs under the tip, `grow` (0..1) of its size; 0 hides it. */
  hangSaliva(points: readonly number[], grow: number): void {
    const n = LICK.tongue.segments;
    if (grow <= 0) {
      this.saliva.setVisible(false);
      return;
    }
    const s = Math.min(1, grow);
    this.saliva
      .setPosition(points[n * 2]!, points[n * 2 + 1]! + LICK.saliva.hangPx * s)
      .setScale(s, s * (1 + (grow > 1 ? grow - 1 : 0)))
      .setVisible(true);
  }

  /** The tongue is in. */
  hideTongue(): void {
    for (const list of [this.jointLines, this.sliceLines, this.joints, this.slices]) {
      for (const image of list) image.setVisible(false);
    }
    this.tip.setVisible(false);
    this.tipLine.setVisible(false);
    this.saliva.setVisible(false);
  }

  /**
   * The wet trail: a blob appears where the tip has passed (`reached` of the way round `shape`,
   * between `from` and `to`) at lick time `nowMs`, and dries in `LICK.trail.dryMs`.
   */
  updateTrail(reached: number, from: number, to: number, shape: LoopShape, nowMs: number): void {
    const { count, alpha, dryMs } = LICK.trail;
    for (let k = 0; k < count; k++) {
      const image = this.wet[k]!;
      const phase = from + ((to - from) * k) / (count - 1);
      if (this.wetAt[k]! < 0) {
        if (reached < phase) continue;
        this.wetAt[k] = nowMs;
        loopPoint(phase - TANGENT_STEP, shape, this.a);
        loopPoint(phase + TANGENT_STEP, shape, this.b);
        const angle = Math.atan2(this.b.y - this.a.y, this.b.x - this.a.x) * RAD_TO_DEG;
        loopPoint(phase, shape, this.a);
        image.setPosition(this.a.x, this.a.y).setAngle(angle).setVisible(true);
      }
      const dry = (nowMs - this.wetAt[k]!) / dryMs;
      if (dry >= 1) {
        image.setVisible(false);
        continue;
      }
      image.setAlpha(alpha * (1 - dry * dry));
    }
  }

  /** Back to nothing shown, the trail forgotten (a new lick). */
  clear(): void {
    this.hideTongue();
    for (let k = 0; k < this.wet.length; k++) {
      this.wet[k]!.setVisible(false);
      this.wetAt[k] = -1;
    }
  }
}
