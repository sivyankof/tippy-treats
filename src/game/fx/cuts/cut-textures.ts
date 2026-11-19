import * as Phaser from 'phaser';
import { CUT_LOOK, CUT_PICTURE, CUT_TEXTURES } from '../../../data/cuts/cut-look';
import { bakeTexture } from '../../ui/bake-texture';

const { pad, outline } = CUT_PICTURE;
const WHITE = 0xffffff;

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
 * Bakes the pictures of the cuts. Safe to call again: baked keys stay. Every one is white, so one
 * picture serves every colour: it is tinted with the colour of the body.
 */
export function bakeCutTextures(scene: Phaser.Scene): void {
  const rib = ribbonPicture();
  const { soft } = CUT_PICTURE.ribbon;
  bakeTexture(scene, CUT_TEXTURES.ribbon, rib.width, rib.height, (g) => {
    // Opaque in the middle, softening to nothing over `soft` px on both long sides: the edge of a
    // bending strip is smooth without antialiasing of its triangles.
    const inner = rib.width - 2 * pad;
    for (let x = 0; x < inner; x++) {
      const alpha = Math.min(1, (Math.min(x, inner - 1 - x) + 0.5) / soft);
      g.fillStyle(WHITE, alpha).fillRect(pad + x, pad, 1, rib.height - 2 * pad);
    }
  });

  const bead = beadPicture();
  bakeTexture(scene, CUT_TEXTURES.bead, bead.width, bead.height, (g) => {
    g.fillStyle(WHITE, 1).fillCircle(bead.width / 2, bead.height / 2, CUT_PICTURE.bead.size / 2);
  });

  const drop = dropPicture();
  bakeTexture(scene, CUT_TEXTURES.drop, drop.width, drop.height, (g) => {
    const { width: w, height: h } = CUT_PICTURE.drop;
    g.fillStyle(WHITE, 1);
    teardrop(g, drop.width / 2, pad, w, h, 0);
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

/** Size of a picture whose shape is `w` x `h` with the empty field around it. */
function padded(w: number, h: number): { width: number; height: number } {
  return { width: w + 2 * pad, height: h + 2 * pad };
}

/** Size of the strip picture (its strip is the middle, `pad` in from every side). */
export function ribbonPicture(): { width: number; height: number } {
  return padded(CUT_PICTURE.ribbon.width, CUT_PICTURE.ribbon.height);
}

/** Size of the disc picture. */
export function beadPicture(): { width: number; height: number } {
  return padded(CUT_PICTURE.bead.size, CUT_PICTURE.bead.size);
}

/** Size of the teardrop picture. */
export function dropPicture(): { width: number; height: number } {
  return padded(CUT_PICTURE.drop.width, CUT_PICTURE.drop.height);
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
