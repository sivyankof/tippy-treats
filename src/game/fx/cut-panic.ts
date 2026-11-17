import type * as Phaser from 'phaser';
import type { Rng } from '../../core/rng';
import { CUT_LOOK, CUT_TEXTURES } from '../../data/cut-look';
import { DEG_TO_RAD, lerp, TWO_PI } from '../../util/math';
import { DEPTH } from '../depth';
import type { LayerView } from '../objects/layer-view';
import { armPictureSize } from './cut-textures';

const P = CUT_LOOK.panic;
const MAX_DASHES = P.dashes.count[1];

type Image = Phaser.GameObjects.Image;

/**
 * What makes a falling piece look scared besides its face: two short arms waving fast at its
 * sides and a few motion dashes flickering above it. Pooled pictures of the shared atlas; they
 * follow the piece and fade with it.
 */
export class CutPanic {
  private readonly arms: Image[] = [];
  private readonly dashes: Image[] = [];
  private dashCount = 0;
  private halfWidth = 0;
  private height = 0;

  constructor(scene: Phaser.Scene) {
    const { originY } = armPictureSize();
    for (let i = 0; i < 2; i++) {
      this.arms.push(
        scene.add
          .image(0, 0, CUT_TEXTURES.arm)
          .setOrigin(0.5, originY)
          .setDepth(DEPTH.cutArms)
          .setVisible(false),
      );
    }
    for (let i = 0; i < MAX_DASHES; i++) {
      this.dashes.push(
        scene.add.image(0, 0, CUT_TEXTURES.dash).setDepth(DEPTH.cutDashes).setVisible(false),
      );
    }
  }

  begin(pieceWidth: number, pieceHeight: number, cake: number, random: Rng): void {
    this.halfWidth = pieceWidth / 2;
    this.height = pieceHeight;
    this.dashCount = random.int(P.dashes.count[0], P.dashes.count[1]);
    for (const arm of this.arms) arm.setTint(cake);
  }

  stop(): void {
    for (const image of this.arms) image.setVisible(false);
    for (const image of this.dashes) image.setVisible(false);
  }

  /** Poses the arms and dashes `sinceMs` after the let-go; `alpha` is the opacity of the piece. */
  update(sinceMs: number, piece: LayerView, alpha: number): void {
    const cos = Math.cos(piece.rotation);
    const sin = Math.sin(piece.rotation);
    // Arms grow out of the piece's sides as it lets go, so they never pop in.
    const grow = Math.min(1, Math.max(0, sinceMs / P.armGrowMs));
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
      arm
        .setPosition(wx, wy)
        .setRotation(piece.rotation - dir * (180 - P.restDeg + swing) * DEG_TO_RAD)
        .setScale(lerp(0.3, 1, grow))
        .setAlpha(alpha * grow)
        .setVisible(grow > 0 && alpha > 0.01);
    }
    for (let i = 0; i < MAX_DASHES; i++) {
      const dash = this.dashes[i]!;
      if (i >= this.dashCount) {
        dash.setVisible(false);
        continue;
      }
      // The dashes flicker: each one is on and off in turn.
      const flicker =
        0.5 + 0.5 * Math.sin((sinceMs / P.dashes.flickerMs + i / this.dashCount) * TWO_PI);
      const offset = (i - (this.dashCount - 1) / 2) * P.dashes.gap;
      const lift = this.height / 2 + P.dashes.lift + (i % 2) * P.dashes.stagger;
      dash
        .setPosition(piece.x + offset, piece.y - lift)
        .setRotation(Math.PI / 2)
        .setAlpha(alpha * flicker * smoothIn(sinceMs))
        .setVisible(alpha * flicker > 0.02);
    }
  }
}

/** Dashes fade in over the first moments after the let-go. */
function smoothIn(sinceMs: number): number {
  return Math.min(1, Math.max(0, sinceMs / P.dashes.fadeInMs));
}
