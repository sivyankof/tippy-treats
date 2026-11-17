import type * as Phaser from 'phaser';
import type { Rng } from '../../core/rng';
import { CUT_LOOK, CUT_PICTURE, CUT_TEXTURES } from '../../data/cut-look';
import { clamp01, DEG_TO_RAD, lerp, smoothstep } from '../../util/math';
import { DEPTH } from '../depth';
import type { LayerView } from '../objects/layer-view';
import {
  middleShare,
  recoilAlpha,
  recoilLength,
  snapTimeMs,
  stagePair,
  strandClock,
  type StagePair,
  type StrandClock,
} from './cut-timeline';
import { strandPictureSize } from './cut-textures';

const S = CUT_LOOK.strands;
const MAX_STRANDS = S.traits.length;
const MAX_BEADS = 2;
const MAX_DROPS = 3;
const LENGTH = CUT_PICTURE.strand.length;
const LAST_STAGE = CUT_TEXTURES.strand.length - 1;
const BEAD_SIZE = CUT_PICTURE.bead.size;
const BLOB_W = CUT_PICTURE.blob.width;

interface Vec {
  x: number;
  y: number;
}

type Image = Phaser.GameObjects.Image;

/** One strand: where it holds on, its look and what it remembers of the snap. */
interface Strand {
  on: boolean;
  trait: (typeof S.traits)[number];
  /** Where it holds on the layer (world) and on the piece (local, from the piece centre). */
  a: Vec;
  local: Vec;
  beads: number;
  beadPhase: number;
  snapped: boolean;
  snapRot: number;
  /** The halves at the snap: from the layer anchor and from the piece anchor to the middle. */
  stubA: Vec;
  stubB: Vec;
  /** Two halves (layer side, piece side), two pictures each: the neighbouring stages blend. */
  halves: [[Image, Image], [Image, Image]];
  bead: Image[];
  /** The bridge of glaze at the let-go. */
  blob: Image;
}

interface Drop {
  image: Image;
  on: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ageMs: number;
}

/** What a strand set tells its owner. */
export interface StrandHooks {
  /** A strand snapped at (x, y); `first` for the first snap of the cut, `main` for the thickest strand. */
  snapped(x: number, y: number, first: boolean, main: boolean): void;
}

/** What starts a set of strands. */
export interface StrandStart {
  /** Side of the cut: 1 when the piece went right. */
  side: 1 | -1;
  /** X of the cut edge of the layer, world. */
  edgeX: number;
  /** Centre y of the layer and of the piece at the start. */
  y: number;
  pieceWidth: number;
  glaze: number;
}

const tmpClock: StrandClock = { phase: 'bridge', stretch: 0, recoil: 0 };
const tmpPair: StagePair = { low: 0, high: 1, weight: 0 };
const fixedPair: StagePair = { low: 0, high: 0, weight: 0 };

/**
 * The glaze strands of one cut: a few tapered ribbons (baked pictures stretched and turned between a
 * point on the layer and a point on the piece), beads sliding down them, the snap with the stubs
 * springing back, and the drops that fall. Pooled pictures of the shared atlas, nothing is redrawn.
 */
export class CutStrands {
  private readonly strands: Strand[] = [];
  private readonly drops: Drop[] = [];
  private start: StrandStart | null = null;
  private snapCount = 0;
  private readonly mid: Vec = { x: 0, y: 0 };
  private readonly point: Vec = { x: 0, y: 0 };
  private readonly originX: number;

  constructor(scene: Phaser.Scene) {
    this.originX = CUT_PICTURE.pad / strandPictureSize().width;
    const make = (key: string, originX = 0.5): Image =>
      scene.add.image(0, 0, key).setOrigin(originX, 0.5).setVisible(false);
    const half = (): [Image, Image] => [
      make(CUT_TEXTURES.strand[0], this.originX).setDepth(DEPTH.cutStrands),
      make(CUT_TEXTURES.strand[0], this.originX).setDepth(DEPTH.cutStrands),
    ];
    for (let i = 0; i < MAX_STRANDS; i++) {
      this.strands.push({
        on: false,
        trait: S.traits[i]!,
        a: { x: 0, y: 0 },
        local: { x: 0, y: 0 },
        beads: 0,
        beadPhase: 0,
        snapped: false,
        snapRot: 0,
        stubA: { x: 0, y: 0 },
        stubB: { x: 0, y: 0 },
        halves: [half(), half()],
        blob: make(CUT_TEXTURES.blob).setDepth(DEPTH.cutBeads),
        bead: Array.from({ length: MAX_BEADS }, () =>
          make(CUT_TEXTURES.bead).setDepth(DEPTH.cutBeads),
        ),
      });
    }
    for (let i = 0; i < MAX_DROPS; i++) {
      this.drops.push({
        image: make(CUT_TEXTURES.bead).setDepth(DEPTH.drips),
        on: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        ageMs: 0,
      });
    }
  }

  /** Whether the strands still have something to show. */
  get busy(): boolean {
    return this.start !== null;
  }

  begin(start: StrandStart, random: Rng): void {
    this.stop();
    this.start = start;
    this.snapCount = 0;
    const count = random.int(S.count[0], S.count[1]);
    const inset = Math.min(S.inset, start.pieceWidth * 0.3);
    this.strands.forEach((strand, i) => {
      strand.on = i < count;
      if (!strand.on) return;
      for (const pair of strand.halves) for (const image of pair) image.setTint(start.glaze);
      const bandY = lerp(S.bandTop, S.bandBottom, strand.trait.band);
      strand.a.x = start.edgeX - start.side * (inset + i * 3);
      strand.a.y = start.y + bandY;
      strand.local.x = -start.side * (start.pieceWidth / 2 - inset - i * 3);
      strand.local.y = bandY;
      strand.beads = random.int(S.beads.count[0], S.beads.count[1]);
      strand.beadPhase = random.next();
      strand.snapped = false;
    });
  }

  stop(): void {
    this.start = null;
    for (const strand of this.strands) {
      strand.on = false;
      this.hideStrand(strand);
    }
    for (const drop of this.drops) {
      drop.on = false;
      drop.image.setVisible(false);
    }
  }

  /**
   * Poses everything `sinceMs` after the let-go of the piece (negative before it). The strands
   * hold on to `piece` and follow it.
   */
  update(sinceMs: number, dtMs: number, piece: LayerView, hooks: StrandHooks): void {
    const start = this.start;
    if (!start) return;
    let live = false;
    for (const strand of this.strands) {
      if (strand.on && this.poseStrand(strand, start, sinceMs, piece, hooks)) live = true;
    }
    if (this.updateDrops(dtMs)) live = true;
    if (!live && sinceMs > snapTimeMs(0) + S.recoilMs) this.stop();
  }

  private poseStrand(
    strand: Strand,
    start: StrandStart,
    sinceMs: number,
    piece: LayerView,
    hooks: StrandHooks,
  ): boolean {
    const { trait } = strand;
    const clock = strandClock(sinceMs, trait.snapShift, tmpClock);
    if (sinceMs < 0 || clock.phase === 'gone') {
      this.hideStrand(strand);
      return false;
    }
    const cos = Math.cos(piece.rotation);
    const sin = Math.sin(piece.rotation);
    const bx = piece.x + cos * strand.local.x - sin * strand.local.y;
    const by = piece.y + sin * strand.local.x + cos * strand.local.y;
    const thick = trait.thick * (S.endThick / CUT_PICTURE.strand.thick);
    if (clock.phase === 'recoil') {
      if (!strand.snapped) this.snap(strand, start, sinceMs, bx, by, piece.rotation, hooks);
      this.poseRecoil(strand, start, clock.recoil, bx, by, piece.rotation, thick);
      return true;
    }
    const mid = this.middlePoint(strand, start, bx, by, sinceMs, clock.stretch);
    stagePair(middleShare(clock.stretch), tmpPair);
    this.poseHalf(strand, 0, strand.a.x, strand.a.y, mid.x, mid.y, thick, 1, tmpPair);
    this.poseHalf(strand, 1, bx, by, mid.x, mid.y, thick, 1, tmpPair);
    this.poseBeads(strand, start, mid, bx, by, sinceMs, clock.stretch, thick);
    this.poseBlob(strand, start, mid, sinceMs);
    return true;
  }

  /** The middle of a strand: halfway, bowed outwards (the piece drifts out), drooping, wobbling a little. */
  private middlePoint(
    strand: Strand,
    start: StrandStart,
    bx: number,
    by: number,
    sinceMs: number,
    stretch: number,
  ): Vec {
    const ax = strand.a.x;
    const ay = strand.a.y;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    const mid = this.mid;
    mid.x = (ax + bx) / 2;
    mid.y = (ay + by) / 2 + Math.min(S.droopMaxPx, len * S.droopShare) * strand.trait.sag;
    if (len > 1) {
      let nx = -dy / len;
      let ny = dx / len;
      if (nx * start.side < 0) {
        nx = -nx;
        ny = -ny;
      }
      const bow =
        Math.min(S.bowMaxPx, len * S.bowShare) * strand.trait.sag * smoothstep(stretch * 2);
      const phase = (sinceMs / S.wobbleMs) * Math.PI * 2 + strand.trait.band * 9;
      const shift = bow + Math.sin(phase) * S.wobblePx * stretch;
      mid.x += nx * shift;
      mid.y += ny * shift;
    }
    return mid;
  }

  /** Poses half `h` of a strand from (fx, fy) to (tx, ty): the two pictures of `pair` blend. */
  private poseHalf(
    strand: Strand,
    h: 0 | 1,
    fx: number,
    fy: number,
    tx: number,
    ty: number,
    thick: number,
    alpha: number,
    pair: StagePair,
  ): void {
    const dx = tx - fx;
    const dy = ty - fy;
    const len = Math.hypot(dx, dy);
    const [low, high] = strand.halves[h];
    if (len < 1.5) {
      low.setVisible(false);
      high.setVisible(false);
      return;
    }
    const angle = Math.atan2(dy, dx);
    this.showImage(low, pair.low, fx, fy, angle, len, thick, alpha * (1 - pair.weight));
    this.showImage(high, pair.high, fx, fy, angle, len, thick, alpha * pair.weight);
  }

  private showImage(
    image: Image,
    stage: number,
    x: number,
    y: number,
    angle: number,
    len: number,
    thick: number,
    alpha: number,
  ): void {
    if (alpha <= 0.01) {
      image.setVisible(false);
      return;
    }
    const key = CUT_TEXTURES.strand[stage]!;
    if (image.texture.key !== key) image.setTexture(key).setOrigin(this.originX, 0.5);
    image
      .setPosition(x, y)
      .setRotation(angle)
      .setScale(len / LENGTH, thick)
      .setAlpha(alpha)
      .setVisible(true);
  }

  private poseBeads(
    strand: Strand,
    start: StrandStart,
    mid: Vec,
    bx: number,
    by: number,
    sinceMs: number,
    stretch: number,
    thick: number,
  ): void {
    for (let b = 0; b < strand.bead.length; b++) {
      const image = strand.bead[b]!;
      if (b >= strand.beads || sinceMs < S.bridgeMs) {
        image.setVisible(false);
        continue;
      }
      // A bead slides from the layer towards the piece, the second one a little behind.
      const slide = (sinceMs - S.bridgeMs) * S.beads.speed * (1 - b * 0.35);
      const u = clamp01(S.beads.startShare + strand.beadPhase * 0.1 + slide);
      const size = S.beads.sizePx * (0.8 + 0.5 * thick) * (1 - 0.25 * stretch);
      const grow = smoothstep((sinceMs - S.bridgeMs) / 80);
      this.pathPoint(strand, mid, bx, by, u);
      image
        .setPosition(this.point.x, this.point.y)
        .setScale((size / BEAD_SIZE) * grow)
        .setTint(start.glaze)
        .setAlpha(1)
        .setVisible(true);
    }
  }

  /** The bridge: a blob of glaze on the cut that grows at once, then shrinks and fades as the strands take over. */
  private poseBlob(strand: Strand, start: StrandStart, mid: Vec, sinceMs: number): void {
    const { growMs, settleMs, widthPx } = S.blob;
    const settle = smoothstep((sinceMs - growMs) / settleMs);
    const alpha = 1 - settle;
    if (alpha <= 0.01) {
      strand.blob.setVisible(false);
      return;
    }
    const scale = strand.trait.thick * (widthPx / BLOB_W) * smoothstep(sinceMs / growMs);
    strand.blob
      .setPosition(mid.x, mid.y)
      .setScale(scale * lerp(1, 0.6, settle), scale * lerp(1, 0.8, settle))
      .setTint(start.glaze)
      .setAlpha(alpha)
      .setVisible(true);
  }

  /** The point at `u` (0..1) along the strand: layer anchor, middle, piece anchor. */
  private pathPoint(strand: Strand, mid: Vec, bx: number, by: number, u: number): void {
    const p = this.point;
    if (u < 0.5) {
      p.x = lerp(strand.a.x, mid.x, u * 2);
      p.y = lerp(strand.a.y, mid.y, u * 2);
    } else {
      p.x = lerp(mid.x, bx, (u - 0.5) * 2);
      p.y = lerp(mid.y, by, (u - 0.5) * 2);
    }
  }

  private snap(
    strand: Strand,
    start: StrandStart,
    sinceMs: number,
    bx: number,
    by: number,
    rotation: number,
    hooks: StrandHooks,
  ): void {
    strand.snapped = true;
    strand.snapRot = rotation;
    const mid = this.middlePoint(strand, start, bx, by, sinceMs, 1);
    strand.stubA.x = mid.x - strand.a.x;
    strand.stubA.y = mid.y - strand.a.y;
    strand.stubB.x = mid.x - bx;
    strand.stubB.y = mid.y - by;
    this.snapCount++;
    const main = strand.trait === S.traits[0];
    if (main) this.spawnDrops(start, mid.x, mid.y);
    hooks.snapped(mid.x, mid.y, this.snapCount === 1, main);
  }

  private poseRecoil(
    strand: Strand,
    start: StrandStart,
    u: number,
    bx: number,
    by: number,
    rotation: number,
    thick: number,
  ): void {
    this.hideBeads(strand);
    strand.blob.setVisible(false);
    const length = recoilLength(u);
    const alpha = recoilAlpha(u);
    const bulge = thick * lerp(1, S.recoil.bulge, smoothstep(u));
    fixedPair.low = LAST_STAGE;
    fixedPair.high = LAST_STAGE;
    const a = strand.stubA;
    this.poseHalf(
      strand,
      0,
      strand.a.x,
      strand.a.y,
      strand.a.x + a.x * length,
      strand.a.y + a.y * length,
      bulge,
      alpha,
      fixedPair,
    );
    // The stub on the piece turns with the piece.
    const turn = rotation - strand.snapRot;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const b = strand.stubB;
    const sx = b.x * cos - b.y * sin;
    const sy = b.x * sin + b.y * cos;
    this.poseHalf(strand, 1, bx, by, bx + sx * length, by + sy * length, bulge, alpha, fixedPair);
    // The curl: each stub turns away from where it pointed as it springs back.
    const curl = S.recoil.curlDeg * DEG_TO_RAD * (1 - (1 - u) * (1 - u));
    this.curl(strand, 0, -start.side * curl);
    this.curl(strand, 1, start.side * curl);
  }

  private curl(strand: Strand, half: 0 | 1, radians: number): void {
    for (const image of strand.halves[half]) if (image.visible) image.rotation += radians;
  }

  private spawnDrops(start: StrandStart, x: number, y: number): void {
    const count = S.drops.count[0] + (this.snapCount % 2);
    for (let n = 0; n < count && n < this.drops.length; n++) {
      const drop = this.drops[n]!;
      drop.on = true;
      drop.x = x + (n - 1) * 5;
      drop.y = y + n * 3;
      drop.vx = start.side * S.drops.speedX * (0.3 + 0.5 * n) * (n % 2 === 0 ? 1 : -0.6);
      drop.vy = -30 + n * 20;
      drop.ageMs = 0;
      drop.image.setTint(start.glaze).setVisible(true);
    }
  }

  private updateDrops(dtMs: number): boolean {
    let any = false;
    const dt = dtMs / 1000;
    for (const drop of this.drops) {
      if (!drop.on) continue;
      drop.ageMs += dtMs;
      if (drop.ageMs >= S.drops.lifeMs) {
        drop.on = false;
        drop.image.setVisible(false);
        continue;
      }
      any = true;
      drop.vy += S.drops.gravity * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      const size = S.drops.sizePx / BEAD_SIZE;
      const stretch = 1 + Math.min(0.5, Math.abs(drop.vy) * 0.0004);
      drop.image
        .setPosition(drop.x, drop.y)
        .setScale(size / Math.sqrt(stretch), size * stretch)
        .setAlpha(1 - smoothstep((drop.ageMs / S.drops.lifeMs - 0.4) / 0.6));
    }
    return any;
  }

  private hideStrand(strand: Strand): void {
    for (const pair of strand.halves) for (const image of pair) image.setVisible(false);
    this.hideBeads(strand);
    strand.blob.setVisible(false);
  }

  private hideBeads(strand: Strand): void {
    for (const bead of strand.bead) bead.setVisible(false);
  }
}
