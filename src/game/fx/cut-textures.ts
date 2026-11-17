import * as Phaser from 'phaser';
import { CUT_LOOK, CUT_PICTURE, CUT_TEXTURES } from '../../data/cut-look';
import { smoothstep } from '../../util/math';
import { bakeTexture } from '../ui/bake-texture';

const { pad, outline, outlineGrey } = CUT_PICTURE;
const WHITE = 0xffffff;

/** Half-thickness of the strand picture at distance `x` from its open end, for the stage `midShare`. */
export function strandHalfThickness(x: number, midShare: number): number {
  const { length, thick, flareHold } = CUT_PICTURE.strand;
  const t = Math.min(1, Math.max(0, (x / length - flareHold) / (1 - flareHold)));
  return (thick * (1 - (1 - midShare) * smoothstep(t))) / 2;
}

/** The outline of a strand as a polygon, grown by `grow` on both sides; open at the left end. */
function strandPoints(midShare: number, grow: number): Phaser.Math.Vector2[] {
  const { length, thick } = CUT_PICTURE.strand;
  const cy = pad + outline + thick / 2;
  const steps = 24;
  const top: Phaser.Math.Vector2[] = [];
  const bottom: Phaser.Math.Vector2[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * length;
    const half = strandHalfThickness(x, midShare) + grow;
    top.push(new Phaser.Math.Vector2(pad + x, cy - half));
    bottom.push(new Phaser.Math.Vector2(pad + x, cy + half));
  }
  return [...top, ...bottom.reverse()];
}

/** Size of one strand picture, and where its thick end sits (origin share). */
export function strandPictureSize(): { width: number; height: number; originY: number } {
  const { length, thick } = CUT_PICTURE.strand;
  const height = thick + 2 * (pad + outline);
  return { width: length + 2 * pad, height, originY: 0.5 };
}

/**
 * Bakes the pictures of the cuts. Safe to call again: baked keys stay. All of them are white with
 * a grey outline, so one picture serves every glaze colour.
 */
export function bakeCutTextures(scene: Phaser.Scene): void {
  const { width, height } = strandPictureSize();
  CUT_PICTURE.strand.midShare.forEach((share, stage) => {
    bakeTexture(scene, CUT_TEXTURES.strand[stage]!, width, height, (g) => {
      // The outline is drawn first; the open left end has no cap line.
      g.fillStyle(outlineGrey, 1).fillPoints(strandPoints(share, outline), true);
      g.fillStyle(WHITE, 1).fillPoints(strandPoints(share, 0), true);
    });
  });

  const bead = CUT_PICTURE.bead.size;
  const beadSize = bead + 2 * (pad + outline);
  bakeTexture(scene, CUT_TEXTURES.bead, beadSize, beadSize, (g) => {
    const c = beadSize / 2;
    g.fillStyle(outlineGrey, 1).fillCircle(c, c, bead / 2 + outline);
    g.fillStyle(WHITE, 1).fillCircle(c, c, bead / 2);
  });

  const { width: blobW, height: blobH } = blobPictureSize();
  bakeTexture(scene, CUT_TEXTURES.blob, blobW, blobH, (g) => {
    const { width, height } = CUT_PICTURE.blob;
    const margin = pad + outline;
    const body = (grow: number, color: number): void => {
      g.fillStyle(color, 1).fillRoundedRect(
        margin - grow,
        margin - grow,
        width + 2 * grow,
        height + 2 * grow,
        width / 2 + grow,
      );
    };
    body(outline, outlineGrey);
    body(0, WHITE);
  });

  const { width: hw, height: hh } = CUT_PICTURE.hang;
  const { width: hangW, height: hangH } = hangPictureSize();
  bakeTexture(scene, CUT_TEXTURES.hang, hangW, hangH, (g) => {
    const cx = hangW / 2;
    const r = hw / 2;
    const top = pad + outline;
    const body = (grow: number, color: number): void => {
      g.fillStyle(color, 1);
      g.fillCircle(cx, top + hh - r, r + grow);
      // The middle of the neck as one block: no seams where the triangles meet.
      g.fillRect(cx - r * 0.45 - grow, top - grow, r * 0.9 + 2 * grow, hh - r + grow);
      // A neck that widens into the round bottom: a drop that hangs on the glaze.
      g.fillTriangle(
        cx - r * 0.45 - grow,
        top - grow,
        cx + r * 0.45 + grow,
        top - grow,
        cx,
        top + hh - r,
      );
      g.fillTriangle(
        cx - r * 0.45 - grow,
        top - grow,
        cx - r - grow,
        top + hh - r,
        cx,
        top + hh - r,
      );
      g.fillTriangle(
        cx + r * 0.45 + grow,
        top - grow,
        cx + r + grow,
        top + hh - r,
        cx,
        top + hh - r,
      );
    };
    body(outline, outlineGrey);
    body(0, WHITE);
    // The neck is open at the top: it grows out of the glaze.
    g.fillStyle(WHITE, 1).fillRect(cx - r * 0.45, pad, r * 0.9, outline + 2);
  });

  const { length, thick, handPx } = CUT_LOOK.panic.arm;
  const { width: armW, height: armH } = armPictureSize();
  bakeTexture(scene, CUT_TEXTURES.arm, armW, armH, (g) => {
    const cx = armW / 2;
    const top = pad + outline;
    const shape = (grow: number, color: number): void => {
      g.fillStyle(color, 1);
      g.fillRoundedRect(
        cx - thick / 2 - grow,
        top - grow,
        thick + 2 * grow,
        length + 2 * grow,
        thick / 2 + grow,
      );
      g.fillCircle(cx, top + length, handPx / 2 + grow);
    };
    shape(outline, outlineGrey);
    shape(0, WHITE);
  });

  const { length: dl, thick: dt } = CUT_PICTURE.dash;
  bakeTexture(scene, CUT_TEXTURES.dash, dl + 2 * pad, dt + 2 * pad, (g) => {
    g.fillStyle(outlineGrey, 1).fillRoundedRect(pad, pad, dl, dt, dt / 2);
  });
}

/** Size of the hanging drop picture and where its neck starts (share of its height from the top). */
export function hangPictureSize(): { width: number; height: number; originY: number } {
  const margin = pad + outline;
  const { width, height } = CUT_PICTURE.hang;
  return {
    width: width + 2 * margin,
    height: height + 2 * margin,
    originY: margin / (height + 2 * margin),
  };
}

/** Size of the arm picture and where its shoulder is (share of its height from the top). */
export function armPictureSize(): { width: number; height: number; originY: number } {
  const { length, thick, handPx } = CUT_LOOK.panic.arm;
  const margin = pad + outline;
  return {
    width: Math.max(handPx, thick) + 2 * margin,
    height: length + handPx / 2 + 2 * margin,
    originY: (margin + thick / 2) / (length + handPx / 2 + 2 * margin),
  };
}

/** Size of the picture of the bridge blob. */
export function blobPictureSize(): { width: number; height: number } {
  const margin = pad + outline;
  const { width, height } = CUT_PICTURE.blob;
  return { width: width + 2 * margin, height: height + 2 * margin };
}
