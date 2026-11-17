import type * as Phaser from 'phaser';
import { SPACE_VISITOR, SPACE_VISITOR_COLORS as K } from '../../../data/space-visitor';
import { DEG_TO_RAD, TWO_PI } from '../../../util/math';
import {
  drawGlossMark,
  ellipsePoints,
  fillOutlinedPolygon,
  fillPolygon,
  outlineColor,
  roundRectPoints,
  type Pt,
} from '../../fx/plain-style';
import { bakePadded } from '../../ui/bake-texture';

type Graphics = Phaser.GameObjects.Graphics;

const GROW = SPACE_VISITOR.outlinePx;
const NO_TILT = 0;

/** Dark warm outline tones of fills too pale for the generic shade (it turns grey on them). */
const OUTLINES = new Map<number, number>([
  [K.porcelain, K.porcelainOutline],
  [K.silver, K.silverOutline],
  [K.cream, K.creamOutline],
  [K.pastry, K.creamOutline],
  [K.glass, K.silverOutline],
]);

function blob(g: Graphics, points: readonly Pt[], fill: number, grow = GROW): void {
  fillOutlinedPolygon(g, points, fill, OUTLINES.get(fill) ?? outlineColor(fill), grow);
}

function oval(g: Graphics, cx: number, cy: number, rx: number, ry: number, fill: number): void {
  blob(g, ellipsePoints(cx, cy, rx, ry, NO_TILT), fill);
}

function flat(g: Graphics, points: readonly Pt[], color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  fillPolygon(g, points);
}

function gloss(g: Graphics, x: number, y: number, length: number, tilt = -0.35): void {
  drawGlossMark(g, {
    x,
    y,
    length,
    thick: length * 0.18,
    tilt,
    dotGap: length * 0.2,
    dotRadius: length * 0.1,
    color: K.gloss,
    alpha: 0.85,
  });
}

function donut(g: Graphics, cx: number, cy: number, r: number): void {
  oval(g, cx, cy, r, r, K.donut);
  g.fillStyle(K.donutHole, 1);
  g.fillCircle(cx, cy, r * 0.32);
  K.sprinkles.forEach((color, i) => {
    const a = (TWO_PI * (i + 0.5)) / K.sprinkles.length + 0.6;
    g.fillStyle(color, 1);
    fillPolygon(
      g,
      ellipsePoints(cx + Math.cos(a) * r * 0.65, cy + Math.sin(a) * r * 0.65, 6, 2.5, a),
    );
  });
}

function drawEclair(g: Graphics): void {
  // The eclair body, its chocolate top and the cream line in between.
  blob(g, roundRectPoints(160, 96, 135, 36, 30), K.pastry);
  flat(g, roundRectPoints(160, 106, 128, 5, 5), K.cream);
  flat(g, roundRectPoints(160, 78, 126, 17, 15), K.glaze);
  gloss(g, 110, 76, 46, 0);
  // The creature in a helmet at the wheel.
  blob(g, ellipsePoints(176, 62, 24, 20, NO_TILT), K.creature);
  blob(g, ellipsePoints(176, 44, 17, 16, NO_TILT), K.creature);
  g.fillStyle(K.creatureEye, 1);
  g.fillCircle(170, 44, 3);
  g.fillCircle(184, 44, 3);
  g.lineStyle(GROW, outlineColor(K.glassStroke), 1);
  g.fillStyle(K.glass, 0.35);
  g.fillCircle(176, 42, 28);
  g.strokeCircle(176, 42, 28);
  gloss(g, 160, 28, 16, -0.9);
  // The windscreen, the headlight and the two donut wheels.
  blob(g, roundRectPoints(226, 58, 16, 12, 8), K.glass);
  oval(g, 294, 98, 8, 8, K.headlight);
  donut(g, 92, 140, 36);
  donut(g, 236, 140, 36);
}

function drawSaucer(g: Graphics): void {
  const { beam } = K;
  const middle = 140;
  // The light beam: two flat warm tones, no blur.
  flat(
    g,
    [
      { x: 100, y: 150 },
      { x: 180, y: 150 },
      { x: 262, y: 292 },
      { x: 18, y: 292 },
    ],
    beam,
    K.beamAlpha,
  );
  flat(
    g,
    [
      { x: 118, y: 150 },
      { x: 162, y: 150 },
      { x: 200, y: 292 },
      { x: 80, y: 292 },
    ],
    K.beamCore,
    K.beamAlpha,
  );
  // The cup liner, upside down: narrow at the top, with stripes.
  blob(
    g,
    [
      { x: 108, y: 38 },
      { x: 172, y: 38 },
      { x: 208, y: 118 },
      { x: 72, y: 118 },
    ],
    K.liner,
  );
  g.fillStyle(K.linerStripe, 1);
  for (const dx of [-30, 0, 30]) {
    fillPolygon(g, [
      { x: middle + dx * 0.4 - 4, y: 44 },
      { x: middle + dx * 0.4 + 4, y: 44 },
      { x: middle + dx * 1.15 + 5, y: 112 },
      { x: middle + dx * 1.15 - 5, y: 112 },
    ]);
  }
  // The frosting disc, scalloped underneath, with its lights.
  for (const x of [46, 93, 140, 187, 234]) oval(g, x, 142, 20, 17, K.frosting);
  oval(g, middle, 124, 132, 30, K.frosting);
  flat(g, ellipsePoints(middle, 114, 98, 11, NO_TILT), K.frostingLight);
  gloss(g, 92, 112, 34, -0.1);
  for (const x of [72, 140, 208]) oval(g, x, 130, 8, 8, K.headlight);
  oval(g, middle, 30, 10, 10, K.beacon);
}

function drawTeapot(g: Graphics): void {
  // The spoon antenna with its light, the spout and the handle, then the body and the lid.
  g.lineStyle(GROW * 2, K.silverOutline, 1);
  g.lineBetween(120, 60, 156, 24);
  g.lineStyle(5, K.silver, 1);
  g.lineBetween(120, 60, 156, 24);
  blob(g, ellipsePoints(164, 16, 16, 11, -40 * DEG_TO_RAD), K.silver);
  g.fillStyle(K.beacon, 1);
  g.fillCircle(164, 16, 4);
  blob(
    g,
    [
      { x: 52, y: 108 },
      { x: 36, y: 66 },
      { x: 14, y: 56 },
      { x: 12, y: 70 },
      { x: 30, y: 82 },
      { x: 62, y: 156 },
    ],
    K.porcelain,
  );
  g.lineStyle(8 + GROW * 2, K.porcelainOutline, 1);
  g.strokeEllipse(206, 128, 52, 70);
  g.lineStyle(8, K.porcelain, 1);
  g.strokeEllipse(206, 128, 52, 70);
  oval(g, 122, 130, 84, 62, K.porcelain);
  flat(g, roundRectPoints(122, 140, 76, 11, 10), K.porcelainPattern);
  g.fillStyle(K.porcelainPattern, 1);
  for (const [x, y] of [
    [92, 112],
    [122, 104],
    [152, 112],
  ] as const)
    g.fillCircle(x, y, 6);
  gloss(g, 82, 100, 30, -0.9);
  oval(g, 122, 70, 44, 14, K.porcelainPattern);
  oval(g, 122, 56, 9, 9, K.porcelainPattern);
}

function drawComet(g: Graphics): void {
  // The powdered-sugar tail: puffs shrinking away from the head, no outline.
  const puffs = 7;
  for (let i = 0; i < puffs; i++) {
    const t = i / (puffs - 1);
    const x = 205 - t * 185;
    const r = 34 - t * 22;
    const y = 75 + Math.sin(i * 1.7) * 10 * (1 - t * 0.4);
    g.fillStyle(K.sugarShade, 1);
    g.fillCircle(x, y + r * 0.18, r);
    g.fillStyle(K.sugar, 1);
    g.fillCircle(x, y - r * 0.08, r * 0.88);
  }
  g.fillStyle(K.sugar, 1);
  for (const [x, y, r] of [
    [60, 34, 5],
    [110, 120, 6],
    [150, 28, 4],
    [30, 108, 4],
    [190, 124, 5],
  ] as const) {
    g.fillCircle(x, y, r);
  }
  // The caramel with twisted wrapper ends.
  blob(
    g,
    [
      { x: 238, y: 75 },
      { x: 212, y: 54 },
      { x: 208, y: 96 },
    ],
    K.wrapper,
  );
  blob(
    g,
    [
      { x: 302, y: 75 },
      { x: 328, y: 56 },
      { x: 332, y: 94 },
    ],
    K.wrapper,
  );
  blob(g, roundRectPoints(270, 75, 40, 28, 20), K.caramel);
  flat(g, roundRectPoints(270, 90, 34, 10, 8), K.caramelDark);
  gloss(g, 258, 60, 26, -0.15);
}

const DRAW: Record<keyof typeof SPACE_VISITOR.guests, (g: Graphics) => void> = {
  eclair: drawEclair,
  saucer: drawSaucer,
  teapot: drawTeapot,
  comet: drawComet,
};

/** Bakes the four guests: one picture each, on the shared sheet, ready before the Space zone shows. */
export function bakeSpaceVisitors(scene: Phaser.Scene): void {
  for (const [id, spec] of Object.entries(SPACE_VISITOR.guests)) {
    const draw = DRAW[id as keyof typeof DRAW];
    bakePadded(scene, spec.texture, spec.width, spec.height, spec.fieldPad, draw);
  }
}
