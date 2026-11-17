import type * as Phaser from 'phaser';
import type { Rng } from '../../core/rng';
import { CUT_LOOK, CUT_PICTURE, CUT_TEXTURES } from '../../data/cut-look';
import { mixColor } from '../../util/color';
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
import { outlineColor } from './plain-style';

const S = CUT_LOOK.strands;
const MAX_STRANDS = S.traits.length;
const MAX_BEADS = 2;
const MAX_DROPS = 3;
const LENGTH = CUT_PICTURE.strand.length;
const BEAD_SIZE = CUT_PICTURE.bead.size;
const BLOB_W = CUT_PICTURE.blob.width;
const DROP_W = CUT_PICTURE.drop.width;
const THICK = CUT_PICTURE.strand.thick;
const STAGES = CUT_PICTURE.strand.midShare;
const WHITE = 0xffffff;

interface Vec {
  x: number;
  y: number;
}

type Image = Phaser.GameObjects.Image;
/** A body: its outline picture (under) and its fill picture (over). */
type Pair = [outline: Image, fill: Image];

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
  halves: [[Pair, Pair], [Pair, Pair]];
  /** A light stripe along each half. */
  gloss: [Image, Image];
  /** Round caps: where it holds on the layer and on the piece; the knuckle in the middle, or the tips of the stubs. */
  caps: [Pair, Pair, Pair, Pair];
  beadPics: { pair: Pair; dot: Image }[];
  /** The bridge of glaze at the let-go. */
  blob: Pair;
  /** Every picture of the strand, to hide it. */
  all: Image[];
}

interface Drop {
  pair: Pair;
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

/** Pictures of a pair are placed together. */
function placePair(
  pair: Pair,
  x: number,
  y: number,
  rotation: number,
  scaleX: number,
  scaleY: number,
  alpha: number,
): void {
  const shown = alpha > 0.01;
  for (const image of pair) {
    image.setPosition(x, y).setRotation(rotation).setScale(scaleX, scaleY).setAlpha(alpha);
    image.setVisible(shown);
  }
}

function hidePair(pair: Pair): void {
  pair[0].setVisible(false);
  pair[1].setVisible(false);
}

/**
 * The glaze strands of one cut: a few tapered ribbons (baked pictures stretched and turned between a
 * point on the layer and a point on the piece), beads sliding down them, the snap with the stubs
 * springing back, and the drops that fall. Every body is an outline picture under and a fill picture
 * over, and all outlines lie under all fills, so the glaze has no seams inside; a light stripe runs
 * along each strand. Pooled pictures of the shared atlas, nothing is redrawn.
 */
export class CutStrands {
  private readonly strands: Strand[] = [];
  private readonly drops: Drop[] = [];
  private start: StrandStart | null = null;
  private snapCount = 0;
  private readonly mid: Vec = { x: 0, y: 0 };
  private readonly point: Vec = { x: 0, y: 0 };
  private readonly originX: number;

  constructor(private readonly scene: Phaser.Scene) {
    this.originX = CUT_PICTURE.pad / strandPictureSize().width;
    for (let i = 0; i < MAX_STRANDS; i++) this.strands.push(this.makeStrand(i));
    for (let i = 0; i < MAX_DROPS; i++) {
      this.drops.push({
        pair: this.pair(CUT_TEXTURES.dropOutline, CUT_TEXTURES.drop),
        on: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        ageMs: 0,
      });
    }
  }

  private image(key: string, depth: number, originX = 0.5): Image {
    return this.scene.add
      .image(0, 0, key)
      .setOrigin(originX, 0.5)
      .setDepth(depth)
      .setVisible(false);
  }

  private pair(outlineKey: string, fillKey: string, originX = 0.5): Pair {
    return [
      this.image(outlineKey, DEPTH.cutGlazeOutline, originX),
      this.image(fillKey, DEPTH.cutGlazeFill, originX),
    ];
  }

  private makeStrand(i: number): Strand {
    const all: Image[] = [];
    const track = (pair: Pair): Pair => {
      all.push(pair[0], pair[1]);
      return pair;
    };
    const half = (): Pair =>
      track(this.pair(CUT_TEXTURES.strandOutline[0], CUT_TEXTURES.strand[0], this.originX));
    const cap = (): Pair => track(this.pair(CUT_TEXTURES.beadOutline, CUT_TEXTURES.bead));
    const gloss = (): Image => {
      const image = this.image(CUT_TEXTURES.gloss, DEPTH.cutGlazeGloss, this.originX);
      all.push(image);
      return image;
    };
    return {
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
      halves: [
        [half(), half()],
        [half(), half()],
      ],
      gloss: [gloss(), gloss()],
      caps: [cap(), cap(), cap(), cap()],
      beadPics: Array.from({ length: MAX_BEADS }, () => {
        const dot = this.image(CUT_TEXTURES.dot, DEPTH.cutGlazeGloss);
        all.push(dot);
        return { pair: track(this.pair(CUT_TEXTURES.beadOutline, CUT_TEXTURES.bead)), dot };
      }),
      blob: track(this.pair(CUT_TEXTURES.blobOutline, CUT_TEXTURES.blob)),
      all,
    };
  }

  /** Whether the strands still have something to show. */
  get busy(): boolean {
    return this.start !== null;
  }

  begin(start: StrandStart, random: Rng): void {
    this.stop();
    this.start = start;
    this.snapCount = 0;
    const light = mixColor(start.glaze, WHITE, S.gloss.mix);
    const outline = outlineColor(start.glaze);
    const count = random.int(S.count[0], S.count[1]);
    const inset = Math.min(S.inset, start.pieceWidth * 0.3);
    const tintPair = (pair: Pair): void => {
      pair[0].setTint(outline);
      pair[1].setTint(start.glaze);
    };
    for (const drop of this.drops) tintPair(drop.pair);
    this.strands.forEach((strand, i) => {
      strand.on = i < count;
      if (!strand.on) return;
      for (const pair of strand.halves) for (const p of pair) tintPair(p);
      for (const pair of strand.caps) tintPair(pair);
      for (const bead of strand.beadPics) {
        tintPair(bead.pair);
        bead.dot.setTint(light);
      }
      tintPair(strand.blob);
      for (const g of strand.gloss) g.setTint(light);
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
      hidePair(drop.pair);
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
    const thick = trait.thick * (S.endThick / THICK);
    if (clock.phase === 'recoil') {
      if (!strand.snapped) this.snap(strand, start, sinceMs, bx, by, piece.rotation, hooks);
      this.poseRecoil(strand, start, clock.recoil, bx, by, piece.rotation, thick);
      return true;
    }
    const mid = this.middlePoint(strand, start, bx, by, sinceMs, clock.stretch);
    const share = middleShare(clock.stretch);
    stagePair(share, tmpPair);
    // The caps hold the ends round: they grow with the bridge, so nothing pops in.
    const grow = smoothstep(sinceMs / S.bridgeMs);
    const anchor = this.capScale(thick * THICK * S.anchorCap) * grow;
    placePair(strand.caps[0], strand.a.x, strand.a.y, 0, anchor, anchor, 1);
    placePair(strand.caps[1], bx, by, 0, anchor, anchor, 1);
    const knuckle = this.capScale(thick * THICK * share);
    placePair(strand.caps[2], mid.x, mid.y, 0, knuckle, knuckle, 1);
    hidePair(strand.caps[3]);
    this.poseHalf(strand, 0, strand.a.x, strand.a.y, mid.x, mid.y, thick, 0, 1, share, tmpPair);
    this.poseHalf(strand, 1, bx, by, mid.x, mid.y, thick, 0, 1, share, tmpPair);
    this.poseBeads(strand, mid, bx, by, sinceMs, clock.stretch, thick);
    this.poseBlob(strand, mid, sinceMs);
    return true;
  }

  /** Scale of a cap picture for a round body of `diameter` px. */
  private capScale(diameter: number): number {
    return diameter / BEAD_SIZE;
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

  /**
   * Poses half `h` of a strand from (fx, fy) to (tx, ty), turned by `turn`: the two stage pictures of
   * `pair` blend, the light stripe runs along the upper side. `share` is the thickness of its far end.
   */
  private poseHalf(
    strand: Strand,
    h: 0 | 1,
    fx: number,
    fy: number,
    tx: number,
    ty: number,
    thick: number,
    turn: number,
    alpha: number,
    share: number,
    pair: StagePair,
  ): void {
    const dx = tx - fx;
    const dy = ty - fy;
    const len = Math.hypot(dx, dy);
    const [low, high] = strand.halves[h];
    const gloss = strand.gloss[h];
    if (len < 1.5) {
      hidePair(low);
      hidePair(high);
      gloss.setVisible(false);
      return;
    }
    const angle = Math.atan2(dy, dx) + turn;
    this.showStage(low, pair.low, fx, fy, angle, len, thick, alpha * (1 - pair.weight));
    this.showStage(high, pair.high, fx, fy, angle, len, thick, alpha * pair.weight);
    // The stripe lifts to the side that is up in the world and thins with the strand.
    let nx = Math.sin(angle);
    let ny = -Math.cos(angle);
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const lift = (CUT_PICTURE.strand.gloss.lift * THICK * thick * (1 + share)) / 4;
    gloss
      .setPosition(fx + nx * lift, fy + ny * lift)
      .setRotation(angle)
      .setScale(len / LENGTH, thick * share)
      .setAlpha(alpha * S.gloss.alpha * smoothstep((share - STAGES[STAGES.length - 1]!) * 4))
      .setVisible(alpha > 0.05);
  }

  private showStage(
    pair: Pair,
    stage: number,
    x: number,
    y: number,
    angle: number,
    len: number,
    thick: number,
    alpha: number,
  ): void {
    if (alpha <= 0.01) {
      hidePair(pair);
      return;
    }
    const [outline, fill] = pair;
    const key = CUT_TEXTURES.strand[stage]!;
    if (fill.texture.key !== key) {
      fill.setTexture(key).setOrigin(this.originX, 0.5);
      outline.setTexture(CUT_TEXTURES.strandOutline[stage]!).setOrigin(this.originX, 0.5);
    }
    placePair(pair, x, y, angle, len / LENGTH, thick, alpha);
  }

  private poseBeads(
    strand: Strand,
    mid: Vec,
    bx: number,
    by: number,
    sinceMs: number,
    stretch: number,
    thick: number,
  ): void {
    for (let b = 0; b < strand.beadPics.length; b++) {
      const { pair, dot } = strand.beadPics[b]!;
      if (b >= strand.beads || sinceMs < S.bridgeMs) {
        hidePair(pair);
        dot.setVisible(false);
        continue;
      }
      // A bead slides from the layer towards the piece, the second one a little behind.
      const slide = (sinceMs - S.bridgeMs) * S.beads.speed * (1 - b * 0.35);
      const u = clamp01(S.beads.startShare + strand.beadPhase * 0.1 + slide);
      const size = S.beads.sizePx * (0.8 + 0.5 * thick) * (1 - 0.25 * stretch);
      const grow = smoothstep((sinceMs - S.bridgeMs) / 80);
      const scale = (size / BEAD_SIZE) * grow;
      this.pathPoint(strand, mid, bx, by, u);
      placePair(pair, this.point.x, this.point.y, 0, scale, scale, 1);
      dot
        .setPosition(this.point.x - size * 0.18 * grow, this.point.y - size * 0.2 * grow)
        .setScale(scale * S.gloss.beadScale * 2)
        .setAlpha(S.gloss.alpha)
        .setVisible(true);
    }
  }

  /** The bridge: a blob of glaze on the cut that grows at once, then shrinks and fades as the strands take over. */
  private poseBlob(strand: Strand, mid: Vec, sinceMs: number): void {
    const { growMs, settleMs, widthPx } = S.blob;
    const settle = smoothstep((sinceMs - growMs) / settleMs);
    const alpha = 1 - settle;
    if (alpha <= 0.01) {
      hidePair(strand.blob);
      return;
    }
    const scale = strand.trait.thick * (widthPx / BLOB_W) * smoothstep(sinceMs / growMs);
    placePair(
      strand.blob,
      mid.x,
      mid.y,
      0,
      scale * lerp(1, 0.6, settle),
      scale * lerp(1, 0.8, settle),
      alpha,
    );
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

  /**
   * The stubs spring back and curl; each ends in a round bulb that swells from the width of the
   * thread to a droplet, then the stub shrinks and fades.
   */
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
    hidePair(strand.blob);
    const { recoil } = S;
    const length = recoilLength(u);
    const alpha = recoilAlpha(u);
    const stub = thick * lerp(recoil.thickStart, recoil.thickEnd, smoothstep(u));
    // The thread thickens from the snapped thinness to a thick stub.
    const lastShare = STAGES[STAGES.length - 1]!;
    const share = lerp(lastShare, STAGES[recoil.stage]!, smoothstep(u * 3));
    stagePair(share, tmpPair);
    const bulb = lerp(
      THICK * lastShare * thick,
      THICK * STAGES[recoil.stage]! * stub * recoil.tip,
      smoothstep(u * 4),
    );
    const curl = recoil.curlDeg * DEG_TO_RAD * (1 - (1 - u) * (1 - u));
    const a = strand.stubA;
    const ax = strand.a.x;
    const ay = strand.a.y;
    const turnA = -start.side * curl;
    this.poseHalf(
      strand,
      0,
      ax,
      ay,
      ax + a.x * length,
      ay + a.y * length,
      stub,
      turnA,
      alpha,
      share,
      tmpPair,
    );
    this.poseTip(strand.caps[2], ax, ay, a.x * length, a.y * length, turnA, bulb, alpha);
    // The stub on the piece turns with the piece.
    const turn = rotation - strand.snapRot;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const b = strand.stubB;
    const sx = b.x * cos - b.y * sin;
    const sy = b.x * sin + b.y * cos;
    const turnB = start.side * curl;
    this.poseHalf(
      strand,
      1,
      bx,
      by,
      bx + sx * length,
      by + sy * length,
      stub,
      turnB,
      alpha,
      share,
      tmpPair,
    );
    this.poseTip(strand.caps[3], bx, by, sx * length, sy * length, turnB, bulb, alpha);
    const anchor = this.capScale(thick * THICK * S.anchorCap) * lerp(1, 0.6, smoothstep(u));
    placePair(strand.caps[0], ax, ay, 0, anchor, anchor, alpha);
    placePair(strand.caps[1], bx, by, 0, anchor, anchor, alpha);
  }

  /** Puts a round bulb of `diameter` px on the far end of a stub from (fx, fy) by (dx, dy), turned by `turn`. */
  private poseTip(
    cap: Pair,
    fx: number,
    fy: number,
    dx: number,
    dy: number,
    turn: number,
    diameter: number,
    alpha: number,
  ): void {
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx) + turn;
    const scale = this.capScale(diameter);
    placePair(cap, fx + Math.cos(angle) * len, fy + Math.sin(angle) * len, 0, scale, scale, alpha);
  }

  private spawnDrops(start: StrandStart, x: number, y: number): void {
    const count = S.drops.count[0] + (this.snapCount % 2);
    for (let n = 0; n < count && n < this.drops.length; n++) {
      const drop = this.drops[n]!;
      drop.on = true;
      drop.x = x + (n - (count - 1) / 2) * S.drops.spreadPx;
      drop.y = y + n * 3;
      drop.vx = start.side * S.drops.speedX * (0.3 + 0.5 * n) * (n % 2 === 0 ? 1 : -0.6);
      drop.vy = -30 + n * 20;
      // Born one after another, so two never fall stacked into one fork.
      drop.ageMs = -n * S.drops.staggerMs;
      hidePair(drop.pair);
    }
  }

  private updateDrops(dtMs: number): boolean {
    let any = false;
    const dt = dtMs / 1000;
    for (const drop of this.drops) {
      if (!drop.on) continue;
      drop.ageMs += dtMs;
      if (drop.ageMs < 0) {
        any = true;
        continue;
      }
      if (drop.ageMs >= S.drops.lifeMs) {
        drop.on = false;
        hidePair(drop.pair);
        continue;
      }
      any = true;
      drop.vy += S.drops.gravity * dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      // A teardrop: its point trails against the way it goes, and it stretches with the speed.
      const speed = Math.hypot(drop.vx, drop.vy);
      const stretch = Math.min(S.drops.maxStretch, speed * S.drops.stretchPerSpeed);
      const age = drop.ageMs / S.drops.lifeMs;
      const size = (S.drops.sizePx / DROP_W) * lerp(1, 0.75, smoothstep(age));
      placePair(
        drop.pair,
        drop.x,
        drop.y,
        Math.atan2(-drop.vx, drop.vy),
        size / Math.sqrt(1 + stretch),
        size * (1 + stretch),
        1 - smoothstep((age - 0.4) / 0.6),
      );
    }
    return any;
  }

  private hideStrand(strand: Strand): void {
    for (const image of strand.all) image.setVisible(false);
  }

  private hideBeads(strand: Strand): void {
    for (const { pair, dot } of strand.beadPics) {
      hidePair(pair);
      dot.setVisible(false);
    }
  }
}
