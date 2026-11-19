import type * as Phaser from 'phaser';
import {
  PLAIN_TOPPERS,
  STRAWBERRY_PAD_PX,
  TOPPER_KINDS,
  topperBakedSize,
  type TopperKind,
} from '../../../data/toppers/plain-toppers';
import { DEG_TO_RAD } from '../../../util/math';
import { bakeTexture } from '../../ui/bake-texture';
import { bakeBerry } from '../economy/berry-texture';
import {
  drawGlossMark,
  drawTwoToneBody,
  ellipsePoints,
  fillOutlinedPolygon,
  fillPolygon,
  glossFromShares,
  outlineColor,
  roundShape,
  type BodyShape,
  type Pt,
} from '../common/plain-style';

const { colors, gloss, outlinePx: grow, kinds } = PLAIN_TOPPERS;

/** Texture key of the picture of a topper kind. */
export function topperTextureKey(kind: TopperKind): string {
  return `topper_${kind}`;
}

/** Points per leaf side: few points make flat facets that show as steps on the outline. */
const LEAF_STEPS = 28;
/** Directions of the stamped outline of a leaf: eight copies of a thin leaf leave scallops. */
const LEAF_OUTLINE_DIRECTIONS = 24;

const circle: BodyShape = (cx, cy, rx, ry) => ellipsePoints(cx, cy, rx, ry, 0);

/** A half disc lying on its flat side: the box is its bounding box. */
const halfDisc: BodyShape = (cx, cy, rx, ry) => {
  const steps = 24;
  const points: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (Math.PI * i) / steps;
    points.push({ x: cx + rx * Math.cos(a), y: cy + ry + 2 * ry * Math.sin(a) });
  }
  return points;
};

/** A pointed leaf from `from` towards angle `rad` (0 is up), as a smooth lens outline. */
export function leaf(from: Pt, rad: number, length: number, width: number): Pt[] {
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const steps = LEAF_STEPS;
  const side = (sign: number): Pt[] => {
    const out: Pt[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const bulge = Math.sin(Math.PI * Math.pow(u, 0.8)) * width * sign;
      out.push({
        x: from.x + dx * length * u - dy * bulge,
        y: from.y + dy * length * u + dx * bulge,
      });
    }
    return out;
  };
  return [...side(1), ...side(-1).reverse()];
}

/** A thick line through `points` with an outline of its own. */
function drawStem(
  g: Phaser.GameObjects.Graphics,
  points: readonly Pt[],
  w: number,
  fill: number,
): void {
  const stroke = (width: number, color: number): void => {
    g.lineStyle(width, color, 1);
    g.beginPath();
    points.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
    g.strokePath();
  };
  stroke(w + grow * 2, outlineColor(fill));
  stroke(w, fill);
}

function glossAt(
  g: Phaser.GameObjects.Graphics,
  cx: number,
  cy: number,
  unit: number,
  color: number,
  at: Pt,
): void {
  drawGlossMark(
    g,
    glossFromShares({ ...gloss, x: 0, y: 0 }, cx + at.x, cy + at.y, unit, color, gloss.alpha),
  );
}

function drawCherry(g: Phaser.GameObjects.Graphics): void {
  const { width: w, restY } = kinds.cherry;
  const c = colors.cherry;
  const r = 22;
  const cx = w / 2;
  const cy = restY - r + 2;
  drawStem(
    g,
    [
      { x: cx, y: cy - r + 3 },
      { x: cx + 3, y: cy - r - 14 },
      { x: cx + 12, y: cy - r - 28 },
      { x: cx + 20, y: cy - r - 33 },
    ],
    4,
    c.stem,
  );
  const hub = { x: cx + 18, y: cy - r - 32 };
  fillOutlinedPolygon(
    g,
    leaf(hub, 70 * DEG_TO_RAD, 22, 7),
    c.leaf,
    outlineColor(c.leaf),
    grow,
    LEAF_OUTLINE_DIRECTIONS,
  );
  g.fillStyle(c.leafLight, 1);
  fillPolygon(g, leaf(hub, 70 * DEG_TO_RAD, 15, 2.4));
  drawTwoToneBody(g, circle, cx, cy, r, r, { base: c.base, shadow: c.shadow, grow, band: 0.16 });
  glossAt(g, cx, cy, r * 2, c.gloss, { x: -r * 0.45, y: -r * 0.4 });
}

function drawLemon(g: Phaser.GameObjects.Graphics): void {
  const { width: w, height: h, restY } = kinds.lemon;
  const c = colors.lemon;
  const rx = w / 2 - grow - 1;
  const ry = (restY - grow - 4) / 2;
  const cx = w / 2;
  const cy = restY - ry - 2;
  drawTwoToneBody(g, halfDisc, cx, cy, rx, ry, {
    base: c.rind,
    shadow: c.rindShadow,
    grow,
    band: 0.08,
  });
  const rind = 6;
  g.fillStyle(c.pulp, 1);
  fillPolygon(g, halfDisc(cx, cy + rind / 2, rx - rind, ry - rind / 2));
  // The wedges: thin lines fanning from the middle of the flat edge.
  const base = { x: cx, y: cy + ry };
  g.lineStyle(2.4, c.segment, 1);
  for (const deg of [-60, -30, 0, 30, 60]) {
    const rad = deg * DEG_TO_RAD;
    g.beginPath();
    g.moveTo(base.x, base.y - 2);
    g.lineTo(
      base.x + Math.sin(rad) * (rx - rind - 3),
      base.y - Math.cos(rad) * (2 * ry - rind - 3),
    );
    g.strokePath();
  }
  glossAt(g, cx, cy, h, c.gloss, { x: -rx * 0.62, y: -ry * 0.1 });
}

function drawMint(g: Phaser.GameObjects.Graphics): void {
  const { width: w, restY } = kinds.mint;
  const c = colors.mint;
  const hub = { x: w / 2, y: restY - 2 };
  for (const [deg, length, width] of [
    [-38, 46, 14],
    [30, 52, 15],
    [-4, 36, 12],
  ] as const) {
    const pts = leaf(hub, deg * DEG_TO_RAD, length, width);
    fillOutlinedPolygon(g, pts, c.base, outlineColor(c.base), grow, LEAF_OUTLINE_DIRECTIONS);
    // The flat shadow: the lower half of the leaf in the darker tone.
    g.fillStyle(c.shadow, 1);
    fillPolygon(
      g,
      leaf(hub, deg * DEG_TO_RAD, length * 0.96, width * 0.34).map((p) => ({
        x: p.x + 2,
        y: p.y + 2,
      })),
    );
    g.lineStyle(2, c.vein, 1);
    g.beginPath();
    g.moveTo(hub.x, hub.y);
    g.lineTo(
      hub.x + Math.sin(deg * DEG_TO_RAD) * length * 0.8,
      hub.y - Math.cos(deg * DEG_TO_RAD) * length * 0.8,
    );
    g.strokePath();
  }
  glossAt(g, hub.x, hub.y, 62, c.gloss, { x: -18, y: -34 });
}

export function drawWafer(g: Phaser.GameObjects.Graphics): void {
  const { width: w, restY } = kinds.wafer;
  const c = colors.wafer;
  const rx = 12;
  const ry = 31;
  g.translateCanvas(w / 2, restY - ry * 0.9);
  g.rotateCanvas(-24 * DEG_TO_RAD);
  drawTwoToneBody(g, roundShape(0.5), 0, 0, rx, ry, {
    base: c.base,
    shadow: c.shadow,
    grow,
    band: 0.16,
  });
  // The opening at the top end and the lattice of the wafer.
  g.fillStyle(outlineColor(c.base), 1);
  fillPolygon(g, ellipsePoints(0, -ry + 3, rx - 1, 5.5, 0));
  g.fillStyle(c.inside, 1);
  fillPolygon(g, ellipsePoints(0, -ry + 3, rx - 4, 3.2, 0));
  g.lineStyle(1.8, c.lattice, 0.9);
  for (let y = -ry + 14; y < ry - 6; y += 10) {
    g.beginPath();
    g.moveTo(-rx + 2, y + 4);
    g.lineTo(rx - 2, y - 4);
    g.strokePath();
    g.beginPath();
    g.moveTo(-rx + 2, y - 4);
    g.lineTo(rx - 2, y + 4);
    g.strokePath();
  }
  glossAt(g, 0, 0, 56, c.gloss, { x: -rx * 0.45, y: -ry * 0.35 });
}

const DRAWERS: Readonly<
  Record<Exclude<TopperKind, 'strawberry'>, (g: Phaser.GameObjects.Graphics) => void>
> = {
  cherry: drawCherry,
  lemon: drawLemon,
  mint: drawMint,
  wafer: drawWafer,
};

/** Bakes the picture of one topper kind (once); returns its texture key. */
export function ensureTopperTexture(scene: Phaser.Scene, kind: TopperKind): string {
  const key = topperTextureKey(kind);
  if (kind === 'strawberry') {
    if (!scene.textures.exists(key)) {
      bakeBerry(scene, key, false, STRAWBERRY_PAD_PX);
    }
    return key;
  }
  const { field } = kinds[kind];
  const s = PLAIN_TOPPERS.bakeScale * PLAIN_TOPPERS.showScale;
  const size = topperBakedSize(kind);
  bakeTexture(scene, key, size.width, size.height, (g) => {
    g.scaleCanvas(s, s);
    g.translateCanvas(field.left, field.top);
    DRAWERS[kind](g);
  });
  return key;
}

/** Bakes the pictures of every kind (the art sheet shows them). */
export function bakeTopperTextures(scene: Phaser.Scene): void {
  for (const kind of TOPPER_KINDS) ensureTopperTexture(scene, kind);
}
