import type * as Phaser from 'phaser';
import type { Rng } from '../../../core/common/rng';
import { CUT_LOOK, CUT_TEXTURES } from '../../../data/cuts/cut-look';
import { clamp01, DEG_TO_RAD, lerp, smoothstep, TWO_PI } from '../../../util/math';
import { mixColor } from '../../../util/color';
import { DEPTH } from '../../common/depth';
import type { LayerView } from '../../objects/tower/layer-view';
import { armPictureSize } from './cut-textures';
import { outlineColor } from '../common/plain-style';

const P = CUT_LOOK.panic;
const D = P.dashes;
const MAX_DASHES = D.count[1];
const WHITE = 0xffffff;

type Image = Phaser.GameObjects.Image;

/** One arm: its three pictures (warm outline, fill, light side). */
interface Arm {
  outline: Image;
  fill: Image;
  light: Image;
}

/**
 * What makes a falling piece look scared besides its face: a short mitten arm waving fast on its
 * outer side (none on the cut side, where it would sit on the cut corner as a bump over the tower)
 * and a few motion dashes trailing behind it. Pooled pictures of the shared atlas; they
 * follow the piece and fade with it.
 */
export class CutPanic {
  private readonly arms: Arm[] = [];
  private readonly dashes: Image[] = [];
  private dashCount = 0;
  private halfWidth = 0;
  private halfHeight = 0;
  /** The side of the piece's arm: away from the tower (1 right). */
  private armSide: 1 | -1 = 1;
  /** Smoothed velocity of the piece (px/s) and where it was, for the dashes. */
  private vx = 0;
  private vy = 0;
  private lastX = 0;
  private lastY = 0;
  private lastMs = -1;

  constructor(scene: Phaser.Scene) {
    const { originY } = armPictureSize();
    const make = (key: string, depth: number): Image =>
      scene.add.image(0, 0, key).setOrigin(0.5, originY).setDepth(depth).setVisible(false);
    for (let i = 0; i < 2; i++) {
      this.arms.push({
        outline: make(CUT_TEXTURES.armOutline, DEPTH.cutArms),
        fill: make(CUT_TEXTURES.arm, DEPTH.cutArmsFill),
        light: make(CUT_TEXTURES.armLight, DEPTH.cutArmsLight),
      });
    }
    for (let i = 0; i < MAX_DASHES; i++) {
      this.dashes.push(
        scene.add.image(0, 0, CUT_TEXTURES.dash).setDepth(DEPTH.cutDashes).setVisible(false),
      );
    }
  }

  /** `side` is where the piece went (1 right): its arm waves on that side. */
  begin(pieceWidth: number, pieceHeight: number, cake: number, side: 1 | -1, random: Rng): void {
    this.halfWidth = pieceWidth / 2;
    this.armSide = side;
    this.halfHeight = pieceHeight / 2;
    this.dashCount = random.int(D.count[0], D.count[1]);
    this.lastMs = -1;
    this.vx = 0;
    this.vy = 0;
    const outline = outlineColor(cake);
    const light = mixColor(cake, WHITE, P.light.mix);
    for (const arm of this.arms) {
      arm.outline.setTint(outline);
      arm.fill.setTint(cake);
      arm.light.setTint(light);
    }
    for (const dash of this.dashes) dash.setTint(outline);
  }

  stop(): void {
    for (const arm of this.arms) {
      arm.outline.setVisible(false);
      arm.fill.setVisible(false);
      arm.light.setVisible(false);
    }
    for (const image of this.dashes) image.setVisible(false);
  }

  /** Poses the arms and dashes `ageMs` after the cut began; `alpha` is the opacity of the piece. */
  update(ageMs: number, piece: LayerView, alpha: number): void {
    this.poseArms(ageMs, piece, alpha);
    this.poseDashes(ageMs, piece, alpha);
  }

  private poseArms(sinceMs: number, piece: LayerView, alpha: number): void {
    const cos = Math.cos(piece.rotation);
    const sin = Math.sin(piece.rotation);
    // Arms grow out of the piece's sides as it lets go, so they never pop in.
    const grow = clamp01(sinceMs / P.armGrowMs);
    const wave = Math.sin((sinceMs / P.wavePeriodMs) * TWO_PI);
    for (let side = 0; side < 2; side++) {
      const dir = side === 0 ? -1 : 1;
      const arm = this.arms[side]!;
      const lx = dir * (this.halfWidth - P.armInset);
      const wx = piece.x + cos * lx - sin * P.armY;
      const wy = piece.y + sin * lx + cos * P.armY;
      // Arms wave out of step: one goes up as the other comes down.
      // The arm hangs down in its picture: half a turn points it up, `restDeg` leans it outwards.
      const swing = wave * P.waveDeg * (side === 0 ? 1 : -1);
      const rotation = piece.rotation - dir * (180 - P.restDeg + swing) * DEG_TO_RAD;
      const scale = lerp(P.armStartScale, 1, grow);
      const shown = dir === this.armSide && grow > 0 && alpha > 0.01;
      // The thumb is on the inner side: the left arm is turned over.
      for (const image of [arm.outline, arm.fill, arm.light]) {
        image
          .setPosition(wx, wy)
          .setRotation(rotation)
          .setFlipX(dir < 0)
          .setScale(scale)
          .setAlpha(alpha * grow)
          .setVisible(shown);
      }
    }
  }

  /** The dashes trail behind the piece along its way, show as it speeds up and breathe a little. */
  private poseDashes(ageMs: number, piece: LayerView, alpha: number): void {
    const dtMs = ageMs - this.lastMs;
    if (this.lastMs >= 0 && dtMs > 0) {
      const k = D.speedEase;
      this.vx = lerp(this.vx, ((piece.x - this.lastX) / dtMs) * 1000, k);
      this.vy = lerp(this.vy, ((piece.y - this.lastY) / dtMs) * 1000, k);
    }
    this.lastX = piece.x;
    this.lastY = piece.y;
    this.lastMs = ageMs;
    const speed = Math.hypot(this.vx, this.vy);
    const power = smoothstep(speed / D.fullSpeed);
    if (speed < 1) {
      for (const dash of this.dashes) dash.setVisible(false);
      return;
    }
    const dirX = this.vx / speed;
    const dirY = this.vy / speed;
    // How far the piece reaches along its way: the dashes start beyond that, so they never lie on its body.
    const along = Math.atan2(dirY, dirX) - piece.rotation;
    const reach =
      this.halfWidth * Math.abs(Math.cos(along)) + this.halfHeight * Math.abs(Math.sin(along));
    const angle = Math.atan2(dirY, dirX);
    for (let i = 0; i < MAX_DASHES; i++) {
      const dash = this.dashes[i]!;
      if (i >= this.dashCount) {
        dash.setVisible(false);
        continue;
      }
      const side = (i - (this.dashCount - 1) / 2) * D.gap;
      const back = reach + D.behind + (i % 2) * D.stagger;
      const breath =
        1 -
        D.breath.share *
          (0.5 + 0.5 * Math.sin((ageMs / D.breath.periodMs + i / this.dashCount) * TWO_PI));
      const a = alpha * power * breath * D.alpha;
      dash
        .setPosition(piece.x - dirX * back - dirY * side, piece.y - dirY * back + dirX * side)
        .setRotation(angle)
        .setScale(lerp(D.lengthScale[0], D.lengthScale[1], power), 1)
        .setAlpha(a)
        .setVisible(a > 0.02);
    }
  }
}
