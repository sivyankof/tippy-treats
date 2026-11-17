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

type Painter = (g: Phaser.GameObjects.Graphics, grow: number) => void;

/** Bakes a body as two white pictures: `fillKey` and `outlineKey` (the same shape grown by `outline`). */
function bakeBody(
  scene: Phaser.Scene,
  fillKey: string,
  outlineKey: string,
  width: number,
  height: number,
  paint: Painter,
): void {
  bakeTexture(scene, outlineKey, width, height, (g) => {
    g.fillStyle(WHITE, 1);
    paint(g, outline);
  });
  bakeTexture(scene, fillKey, width, height, (g) => {
    g.fillStyle(WHITE, 1);
    paint(g, 0);
  });
}

/** A teardrop with its round belly at the bottom and a rounded point at the top, grown by `grow`. */
function teardrop(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  top: number,
  width: number,
  height: number,
  grow: number,
): void {
  const r = width / 2;
  const tipR = CUT_PICTURE.drop.tipRadius;
  const cy = top + height - r;
  const steps = 14;
  const left: Phaser.Math.Vector2[] = [];
  const right: Phaser.Math.Vector2[] = [];
  // The neck widens from the tip to the belly along a concave curve.
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = top + tipR + (cy - top - tipR) * t;
    const half = tipR + (r - tipR) * Math.pow(t, CUT_PICTURE.drop.neckCurve) + grow;
    left.push(new Phaser.Math.Vector2(cx - half, y));
    right.push(new Phaser.Math.Vector2(cx + half, y));
  }
  const belly: Phaser.Math.Vector2[] = [];
  for (let i = 1; i < steps; i++) {
    const angle = Math.PI * (i / steps);
    belly.push(
      new Phaser.Math.Vector2(cx - Math.cos(angle) * (r + grow), cy + Math.sin(angle) * (r + grow)),
    );
  }
  g.fillPoints([...left, ...belly, ...right.reverse()], true);
  g.fillCircle(cx, top + tipR, tipR + grow);
}

/**
 * Bakes the pictures of the cuts. Safe to call again: baked keys stay. Every one is white (the
 * outline picture too), so one picture serves every colour: the fill is tinted with the colour of
 * the body, the outline with its warm dark tone.
 */
export function bakeCutTextures(scene: Phaser.Scene): void {
  const { width, height } = strandPictureSize();
  CUT_PICTURE.strand.midShare.forEach((share, stage) => {
    // The open left end has no cap line: both pictures start at the same x.
    bakeBody(
      scene,
      CUT_TEXTURES.strand[stage]!,
      CUT_TEXTURES.strandOutline[stage]!,
      width,
      height,
      (g, grow) => g.fillPoints(strandPoints(share, grow), true),
    );
  });

  const { length, gloss } = CUT_PICTURE.strand;
  bakeTexture(scene, CUT_TEXTURES.gloss, width, height, (g) => {
    const cy = height / 2;
    g.fillStyle(WHITE, 1).fillRoundedRect(
      pad + length * gloss.from,
      cy - gloss.thick / 2,
      length * (gloss.to - gloss.from),
      gloss.thick,
      gloss.thick / 2,
    );
  });

  const bead = CUT_PICTURE.bead.size;
  const beadSize = bead + 2 * (pad + outline);
  bakeBody(scene, CUT_TEXTURES.bead, CUT_TEXTURES.beadOutline, beadSize, beadSize, (g, grow) =>
    g.fillCircle(beadSize / 2, beadSize / 2, bead / 2 + grow),
  );

  const dot = CUT_PICTURE.dot;
  bakeTexture(scene, CUT_TEXTURES.dot, dot.width + 2 * pad, dot.height + 2 * pad, (g) => {
    g.fillStyle(WHITE, 1).fillEllipse(
      pad + dot.width / 2,
      pad + dot.height / 2,
      dot.width,
      dot.height,
    );
  });

  const { width: blobW, height: blobH } = blobPictureSize();
  bakeBody(scene, CUT_TEXTURES.blob, CUT_TEXTURES.blobOutline, blobW, blobH, (g, grow) => {
    const { width: w, height: h } = CUT_PICTURE.blob;
    const margin = pad + outline;
    g.fillRoundedRect(margin - grow, margin - grow, w + 2 * grow, h + 2 * grow, w / 2 + grow);
  });

  const { width: dropW, height: dropH } = dropPictureSize();
  bakeBody(scene, CUT_TEXTURES.drop, CUT_TEXTURES.dropOutline, dropW, dropH, (g, grow) => {
    const { width: w, height: h } = CUT_PICTURE.drop;
    teardrop(g, dropW / 2, pad + outline, w, h, grow);
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

  const arm = CUT_LOOK.panic.arm;
  const { width: armW, height: armH } = armPictureSize();
  const top = pad + outline;
  const cx = armW / 2;
  const mitten = (g: Phaser.GameObjects.Graphics, grow: number): void => {
    g.fillRoundedRect(
      cx - arm.thick / 2 - grow,
      top - grow,
      arm.thick + 2 * grow,
      arm.length + 2 * grow,
      arm.thick / 2 + grow,
    );
    // A round mitten with a thumb on one side.
    g.fillCircle(cx, top + arm.length, arm.handPx / 2 + grow);
    g.fillCircle(cx + arm.thumbOutPx, top + arm.length - arm.handPx * 0.35, arm.thumbPx / 2 + grow);
  };
  bakeBody(scene, CUT_TEXTURES.arm, CUT_TEXTURES.armOutline, armW, armH, mitten);
  bakeTexture(scene, CUT_TEXTURES.armLight, armW, armH, (g) => {
    const { widthPx, offsetPx } = CUT_LOOK.panic.light;
    g.fillStyle(WHITE, 1);
    g.fillRoundedRect(
      cx - offsetPx - widthPx / 2,
      top + arm.thick * 0.35,
      widthPx,
      arm.length - arm.thick * 0.2,
      widthPx / 2,
    );
    g.fillEllipse(cx - arm.handPx * 0.22, top + arm.length - arm.handPx * 0.2, 6, 4);
  });

  const { length: dl, thick: dt } = CUT_PICTURE.dash;
  bakeTexture(scene, CUT_TEXTURES.dash, dl + 2 * pad, dt + 2 * pad, (g) => {
    g.fillStyle(WHITE, 1).fillRoundedRect(pad, pad, dl, dt, dt / 2);
  });
}

/** Size of the teardrop picture. */
export function dropPictureSize(): { width: number; height: number } {
  const margin = pad + outline;
  const { width, height } = CUT_PICTURE.drop;
  return { width: width + 2 * margin, height: height + 2 * margin };
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
  const { length, thick, handPx, thumbOutPx, thumbPx } = CUT_LOOK.panic.arm;
  const margin = pad + outline;
  const half = Math.max(handPx / 2, thumbOutPx + thumbPx / 2);
  return {
    width: 2 * half + 2 * margin,
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
