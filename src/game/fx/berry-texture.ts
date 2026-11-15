import type * as Phaser from 'phaser';
import { BERRY_LOOK } from '../../data/berry-look';
import { DEG_TO_RAD } from '../../util/math';
import { bakeTexture } from '../ui/bake-texture';
import {
  OUTLINE_SHARE,
  drawGlossMark,
  ellipsePoints,
  fillPolygon,
  outlineColor,
  type Pt,
} from './plain-style';

const { colors, body, gloss, seeds, calyx, face } = BERRY_LOOK;

/** Half width of the body at `u` (0 top .. 1 bottom), as a share of the full half width. */
function bodyHalfWidth(u: number): number {
  return Math.pow(Math.sin(Math.PI * Math.pow(u, body.profileLift)), body.profileRound);
}

/** The strawberry outline around (cx, cy) with half sizes `rx`, `ry`. */
function bodyOutline(cx: number, cy: number, rx: number, ry: number): Pt[] {
  const points: Pt[] = [];
  const steps = body.outlineSteps;
  // Down the right side, then back up the left.
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    points.push({ x: cx + rx * bodyHalfWidth(u), y: cy - ry + 2 * ry * u });
  }
  for (let i = steps; i >= 0; i--) {
    const u = i / steps;
    points.push({ x: cx - rx * bodyHalfWidth(u), y: cy - ry + 2 * ry * u });
  }
  return points;
}

/** One pointed leaf from `from` out along `rad` for `length`, `width` wide in the middle. */
function leafPoints(from: Pt, rad: number, length: number, width: number): Pt[] {
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const nx = -dy;
  const ny = dx;
  const at = (along: number, side: number): Pt => ({
    x: from.x + dx * along + nx * side,
    y: from.y + dy * along + ny * side,
  });
  return [
    at(0, 0),
    at(length * 0.35, -width),
    at(length * 0.8, -width * 0.55),
    at(length, 0),
    at(length * 0.8, width * 0.55),
    at(length * 0.35, width),
  ];
}

function drawBody(g: Phaser.GameObjects.Graphics, size: number, cx: number, cy: number): void {
  const rx = size * body.halfWidth;
  const ry = size * body.halfHeight;
  const grow = 2 * ry * OUTLINE_SHARE;
  g.fillStyle(outlineColor(colors.base), 1);
  fillPolygon(g, bodyOutline(cx, cy, rx + grow, ry + grow));
  g.fillStyle(colors.shadow, 1);
  fillPolygon(g, bodyOutline(cx, cy, rx, ry));
  // The lit body is a smaller copy pushed to the top left: what stays visible is the flat band.
  const band = body.bandShare;
  g.fillStyle(colors.base, 1);
  fillPolygon(g, bodyOutline(cx - rx * band, cy - ry * band, rx * (1 - band), ry * (1 - band)));
}

function drawGloss(g: Phaser.GameObjects.Graphics, size: number, cx: number, cy: number): void {
  drawGlossMark(g, {
    x: cx + gloss.x * size * body.halfWidth,
    y: cy + gloss.y * size * body.halfHeight,
    length: size * gloss.length,
    thick: size * gloss.thick,
    tilt: gloss.tiltDeg * DEG_TO_RAD,
    dotGap: size * gloss.dotGap,
    dotRadius: size * gloss.dotRadius,
    color: colors.gloss,
    alpha: gloss.alpha,
  });
}

function drawSeeds(g: Phaser.GameObjects.Graphics, size: number, cx: number, cy: number): void {
  const rx = size * body.halfWidth;
  const ry = size * body.halfHeight;
  g.fillStyle(colors.seed, 1);
  for (const row of seeds.rows) {
    const half = bodyHalfWidth(row.at) * rx * seeds.spread;
    const y = cy - ry + 2 * ry * row.at;
    for (let k = 0; k < row.count; k++) {
      const share = row.count < 2 ? 0 : (2 * k) / (row.count - 1) - 1;
      const x = cx + share * half;
      if (Math.hypot((x - cx) / rx - gloss.x, (y - cy) / ry - gloss.y) < seeds.glossClearance) {
        continue;
      }
      // Seeds on the sides lean outward: they sit on a round body.
      fillPolygon(g, ellipsePoints(x, y, size * seeds.rx, size * seeds.ry, share * 0.35));
    }
  }
}

function drawCalyx(g: Phaser.GameObjects.Graphics, size: number, cx: number, cy: number): void {
  const ry = size * body.halfHeight;
  const hub: Pt = { x: cx, y: cy - ry + 2 * ry * calyx.sinkShare };
  const stemW = size * calyx.stemWidth;
  const stemH = size * calyx.stemHeight;
  const grow = 2 * ry * OUTLINE_SHARE;
  const leafWidth = size * calyx.leafWidth;
  // Back to front: the leaves that stand up go first, the ones draped on the body after.
  const order = [...calyx.leaves].sort((a, b) => Math.abs(a.deg) - Math.abs(b.deg));
  // The outline of the whole calyx first, so the leaves share one silhouette.
  g.fillStyle(outlineColor(colors.leaf), 1);
  for (const leaf of order) {
    const length = size * leaf.length + grow;
    fillPolygon(g, leafPoints(hub, leaf.deg * DEG_TO_RAD, length, leafWidth + grow));
  }
  g.fillRoundedRect(
    hub.x - stemW / 2 - grow,
    hub.y - stemH - grow,
    stemW + grow * 2,
    stemH + stemW * 0.4 + grow,
    stemW * 0.45,
  );
  g.fillStyle(colors.leaf, 1);
  for (const leaf of order) {
    fillPolygon(g, leafPoints(hub, leaf.deg * DEG_TO_RAD, size * leaf.length, leafWidth));
  }
  // The second tone: a lighter strip down the middle of each leaf.
  g.fillStyle(colors.leafLight, 1);
  for (const leaf of order) {
    const length = size * leaf.length * calyx.lightLength;
    fillPolygon(g, leafPoints(hub, leaf.deg * DEG_TO_RAD, length, leafWidth * calyx.lightWidth));
  }
  g.fillStyle(colors.stem, 1);
  g.fillRoundedRect(hub.x - stemW / 2, hub.y - stemH, stemW, stemH + stemW * 0.4, stemW * 0.45);
}

/** Two dot eyes and a smile in the lower middle of the body. */
function drawFace(g: Phaser.GameObjects.Graphics, size: number, cx: number, cy: number): void {
  const half = (size * face.eyeSpacing) / 2;
  g.fillStyle(colors.face, 1);
  g.fillCircle(cx - half, cy + size * face.eyeY, size * face.eyeRadius);
  g.fillCircle(cx + half, cy + size * face.eyeY, size * face.eyeRadius);
  const span = (face.smileSpanDeg * DEG_TO_RAD) / 2;
  const down = Math.PI / 2;
  const radius = size * face.smileRadius;
  g.lineStyle(size * face.smileThick, colors.face, 1);
  g.beginPath();
  g.arc(cx, cy + size * face.smileY - radius, radius, down - span, down + span);
  g.strokePath();
}

/**
 * Bakes the berry in the manner of the plain layers: flat two-tone fill, thick outline, a
 * highlight stroke and dot, big seeds and a two-tone calyx. `withFace` adds the small face of
 * the large picture. Not meant for tinting.
 */
export function bakeBerry(scene: Phaser.Scene, key: string, withFace: boolean): void {
  const size = BERRY_LOOK.textureSize;
  const cx = size / 2;
  const cy = size * body.centerY;
  bakeTexture(scene, key, size, size, (g) => {
    drawBody(g, size, cx, cy);
    drawSeeds(g, size, cx, cy);
    drawGloss(g, size, cx, cy);
    if (withFace) drawFace(g, size, cx, cy);
    drawCalyx(g, size, cx, cy);
  });
}
