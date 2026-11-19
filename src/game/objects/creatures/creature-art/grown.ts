import { ANIM } from '../../../../data/common/anim';
import { faceRecipe } from '../../../../data/creatures/creature-looks';
import type { CreatureId } from '../../../../data/creatures/creatures';
import { GROWN_LOOKS, type CreatureStage } from '../../../../data/creatures/mastery-look';
import { PALETTE } from '../../../../data/common/palette';
import { RAINBOW_BAND_COLORS, RAINBOW_LOOK } from '../../../../data/creatures/rainbow-look';
import { SPRINKLE_COLORS } from '../../../../data/creatures/creature-looks';
import { cssColor, mixColor, parseHex, shade } from '../../../../util/color';
import { TWO_PI } from '../../../../util/math';
import { faceHalfSpan } from '../../../fx/glaze/glaze-growth';
import {
  ellipsePoints,
  fillOutlinedPolygon,
  fillPolygon,
  outlineColor,
  type Pt,
} from '../../../fx/common/plain-style';
import { faceLayout } from '../face-recipe';
import { layerBox } from '../../tower/layer-draw';
import { sparklerTip, standX } from './grown-anchors';
import { starPoints } from './rainbow-geometry';
import {
  countFor,
  creatureColors,
  outlinedCircle,
  scatter,
  spread,
  stroke,
  type ArtContext,
  type Graphics,
} from './primitives';

/** Half the height the face takes: details inside the body keep clear of the middle band of this height. */
const FACE_BAND = 46;
/** The line of a baked detail's outline, pixels. */
const LINE = ANIM.layer.outline / 2;
const BASE_OVERLAP = 6;
const HEX_POINTS = 6;
const ARC_STEPS = 14;
const SPIRAL_STEP = 0.35;
const PETALS = 4;

/** A closed shape with the outline of the creature (a thick dark line around the fill). */
function outlined(ctx: ArtContext, points: readonly Pt[], fill: number): void {
  fillOutlinedPolygon(ctx.g, points, fill, ctx.colors.outline, LINE);
}

/** A circle with the outline of the creature. */
function dot(ctx: ArtContext, x: number, y: number, r: number, fill: number, line = LINE): void {
  outlinedCircle(ctx.g, x, y, r, fill, ctx.colors.outline, line);
}

/** A small white glint. */
function glint(g: Graphics, x: number, y: number, r: number, alpha = 0.9): void {
  g.fillStyle(PALETTE.textLight, alpha);
  g.fillCircle(x, y, r);
}

/** Half width of the face of this creature at the layer width, plus a gap: details inside the body keep out of it. */
function faceKeep(ctx: ArtContext, creature: CreatureId, gap: number): number {
  return faceHalfSpan(ctx.box.width, faceRecipe(creature, true)) + gap;
}

/** True when a thing at (x, y) of radius r would land on the face. */
function onFace(keep: number, x: number, y: number, r: number): boolean {
  return Math.abs(x) < keep + r && Math.abs(y) < FACE_BAND + r;
}

/** A regular polygon with `count` corners (a hexagon: a honeycomb cell). */
function ngon(cx: number, cy: number, r: number, count: number): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const a = -Math.PI / 2 + (TWO_PI * i) / count;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  });
}

/** The upper half of an ellipse whose flat side is the line `y = baseY`, as a closed outline. */
function dome(cx: number, baseY: number, rx: number, ry: number): Pt[] {
  const points: Pt[] = [];
  for (let i = 0; i <= ARC_STEPS; i++) {
    const a = Math.PI + (Math.PI * i) / ARC_STEPS;
    points.push({ x: cx + rx * Math.cos(a), y: baseY + ry * Math.sin(a) });
  }
  return points;
}

/** A drop, point up, with its round belly at (x, y). */
function drop(ctx: ArtContext, x: number, y: number, r: number, fill: number, shine: number): void {
  const { g, colors } = ctx;
  const tip: Pt[] = [
    { x: x - r * 0.9, y: y - r * 0.3 },
    { x: x + r * 0.9, y: y - r * 0.3 },
    { x, y: y - r * 2.1 },
  ];
  g.fillStyle(colors.outline, 1);
  fillPolygon(g, grow(tip, LINE));
  g.fillCircle(x, y, r + LINE);
  g.fillStyle(fill, 1);
  fillPolygon(g, tip);
  g.fillCircle(x, y, r);
  glint(g, x - r * 0.35, y - r * 0.1, r * shine);
}

/** The points pushed away from their centre by `by` (a cheap outline of a convex shape). */
function grow(points: readonly Pt[], by: number): Pt[] {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return points.map((p) => {
    const d = Math.hypot(p.x - cx, p.y - cy) || 1;
    return { x: p.x + ((p.x - cx) / d) * by, y: p.y + ((p.y - cy) / d) * by };
  });
}

/** Four-point star of outer radius r. */
function sparkle(g: Graphics, x: number, y: number, r: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  fillPolygon(g, starPoints(x, y, r, 0.28, 4));
}

function drawHoneyGrown(ctx: ArtContext): void {
  const { g, box, colors } = ctx;
  const look = GROWN_LOOKS.honey;
  const fill = parseHex(look.cellFill);
  const inner = mixColor(fill, colors.glaze, 0.35);
  const cells = [...look.cells].sort((a, b) => b.up - a.up);
  // The side cells first, the tall middle one in front.
  for (const cell of [...cells].reverse()) {
    const y = box.top - cell.up + BASE_OVERLAP;
    outlined(ctx, ngon(cell.dx, y, cell.r, HEX_POINTS), fill);
    g.fillStyle(inner, 1);
    fillPolygon(g, ngon(cell.dx, y, cell.r * look.cellInner, HEX_POINTS));
    glint(g, cell.dx - cell.r * 0.3, y - cell.r * 0.45, cell.r * 0.14);
  }
  const x = box.innerRight - look.drop.fromEdge;
  const y = look.drop.dy;
  if (!onFace(faceKeep(ctx, 'honey', look.faceGap), x, y, look.drop.r)) {
    drop(ctx, x, y, look.drop.r, parseHex(look.drop.fill), look.drop.shine);
  }
}

function drawPuffGrown(ctx: ArtContext): void {
  const { g, box, colors } = ctx;
  const look = GROWN_LOOKS.puff;
  const cream = parseHex(look.cream);
  for (const ring of look.swirl) {
    const y = box.top - ring.up + BASE_OVERLAP;
    outlined(ctx, ellipsePoints(0, y, ring.rx, ring.ry, 0), cream);
    stroke(g, 3, colors.accent, 0.7, [
      [-ring.rx * 0.6, y + ring.ry * 0.1],
      [0, y + ring.ry * 0.45],
      [ring.rx * 0.6, y + ring.ry * 0.1],
    ]);
  }
  const { cherry } = look;
  const cy = box.top - cherry.up + BASE_OVERLAP;
  const fill = parseHex(cherry.fill);
  stroke(g, 3, colors.outline, 1, [
    [0, cy + cherry.r * 0.5],
    [-cherry.stem * 0.2, cy - cherry.stem * 0.6],
    [cherry.stem * 0.7, cy - cherry.stem],
  ]);
  dot(ctx, 0, cy, cherry.r, fill);
  glint(g, -cherry.r * 0.35, cy - cherry.r * 0.35, cherry.r * cherry.shine);
}

function drawJellyGrown(ctx: ArtContext): void {
  const { g, box, colors } = ctx;
  const look = GROWN_LOOKS.jelly;
  const keep = faceKeep(ctx, 'jelly', look.faceGap);
  const count = countFor(box.width, look.inside.perFullWidth);
  const margin = look.inside.margin;
  for (let i = 0; i < count; i++) {
    const r = look.inside.minR + look.inside.rangeR * scatter(i, 0.35);
    const x = box.innerLeft + margin + scatter(i, 0.25) * (box.innerW - margin * 2);
    const y = box.innerTop + margin + scatter(i, 0.7) * (box.innerH - margin * 2);
    if (onFace(keep, x, y, r)) continue;
    g.fillStyle(colors.accent, look.inside.alpha);
    g.fillCircle(x, y, r);
    g.lineStyle(3, colors.detail, 0.9);
    g.strokeCircle(x, y, r);
    glint(g, x - r * 0.35, y - r * 0.35, r * 0.28);
  }
  for (const b of look.rising) {
    const x = Math.max(box.left + b.r, Math.min(box.right - b.r, b.dx * box.width));
    const y = box.top - b.up + BASE_OVERLAP;
    g.fillStyle(colors.accent, look.inside.alpha + 0.1);
    g.fillCircle(x, y, b.r);
    g.lineStyle(3, colors.outline, 0.9);
    g.strokeCircle(x, y, b.r);
    glint(g, x - b.r * 0.35, y - b.r * 0.35, b.r * 0.28);
  }
}

function drawCaramelGrown(ctx: ArtContext): void {
  const { g, box, colors } = ctx;
  const look = GROWN_LOOKS.caramel;
  const x = standX(box.width, look.stand.share, look.stand.minFromEdge);
  const discY = box.top - look.disc.up;
  stroke(g, look.threads.width, colors.glaze, 0.95, [
    [x - look.threads.spread / 2, discY + look.disc.r * 0.8],
    [x - look.threads.spread * 1.4, (discY + box.top) / 2 + 6],
    [x - look.threads.spread * 0.9, box.top + BASE_OVERLAP],
  ]);
  stroke(g, look.threads.width, colors.glaze, 0.95, [
    [x + look.threads.spread / 2, discY + look.disc.r * 0.8],
    [x + look.threads.spread * 1.4, (discY + box.top) / 2 + 6],
    [x + look.threads.spread * 0.9, box.top + BASE_OVERLAP],
  ]);
  const stickHalf = look.stick.width / 2;
  outlined(
    ctx,
    [
      { x: x - stickHalf, y: box.top + BASE_OVERLAP },
      { x: x + stickHalf, y: box.top + BASE_OVERLAP },
      { x: x + stickHalf, y: discY },
      { x: x - stickHalf, y: discY },
    ],
    colors.accent,
  );
  dot(ctx, x, discY, look.disc.r, colors.detail);
  const pts: Array<readonly [number, number]> = [];
  const total = TWO_PI * look.disc.turns;
  for (let t = 0; t <= total; t += SPIRAL_STEP) {
    const r = 2 + ((look.disc.r - look.disc.line - 1) * t) / total;
    pts.push([x + r * Math.cos(t), discY + r * Math.sin(t)]);
  }
  stroke(g, look.disc.line, colors.glaze, 1, pts);
  glint(g, x - look.disc.r * 0.55, discY - look.disc.r * 0.55, look.disc.r * 0.11, 0.8);
}

function drawFrostyGrown(ctx: ArtContext): void {
  const { g, box, colors } = ctx;
  const look = GROWN_LOOKS.frosty;
  const ice = parseHex(look.ice);
  const spikes = [...look.spikes].sort((a, b) => a.up - b.up);
  for (const s of spikes) {
    const base = box.top + BASE_OVERLAP;
    outlined(
      ctx,
      [
        { x: s.dx - s.w / 2, y: base },
        { x: s.dx + s.w / 2, y: base },
        { x: s.dx + s.w * 0.1, y: box.top - s.up },
      ],
      ice,
    );
    stroke(g, 2.5, PALETTE.textLight, 0.9, [
      [s.dx - s.w * 0.2, base - 4],
      [s.dx + s.w * 0.02, box.top - s.up + s.w * 0.7],
    ]);
  }
  const keep = faceKeep(ctx, 'frosty', look.faceGap);
  const count = countFor(box.width, look.flakes.perFullWidth);
  const flake = shade(colors.accent, look.flakes.shade);
  for (let i = 0; i < count; i++) {
    const x = spread(i, count, box.innerLeft + 26, box.innerRight - 26);
    const y = i % 2 === 0 ? -24 : 26;
    if (onFace(keep, x, y, look.flakes.arm)) continue;
    for (let k = 0; k < PETALS - 1; k++) {
      const a = (Math.PI * k) / (PETALS - 1);
      const dx = Math.cos(a) * look.flakes.arm;
      const dy = Math.sin(a) * look.flakes.arm;
      stroke(g, look.flakes.line, flake, 1, [
        [x - dx, y - dy],
        [x + dx, y + dy],
      ]);
    }
    glint(g, x, y, look.flakes.line * 0.6, 1);
  }
}

function drawBrownieGrown(ctx: ArtContext): void {
  const { g, box, colors } = ctx;
  const look = GROWN_LOOKS.brownie;
  const half = Math.min(box.width * look.helmet.share, look.helmet.maxHalf);
  const baseY = box.top + look.helmet.dip;
  const ry = look.helmet.up + look.helmet.dip;
  outlined(ctx, dome(0, baseY, half, ry), colors.sponge);
  g.fillStyle(colors.glaze, 1);
  g.fillRect(-half + LINE, baseY - look.helmet.rim, (half - LINE) * 2, look.helmet.rim);
  stroke(g, 5, PALETTE.textLight, 0.45, [
    [-half * 0.62, baseY - ry * 0.45],
    [-half * 0.35, baseY - ry * 0.78],
  ]);
  for (const n of look.nuts) {
    const x = n.dx * half;
    const y = baseY - look.helmet.rim - n.up * (ry - look.helmet.rim);
    g.fillStyle(colors.outline, 1);
    g.fillEllipse(x, y, look.nut.w + look.nut.outline * 2, look.nut.h + look.nut.outline * 2);
    g.fillStyle(colors.detail, 1);
    g.fillEllipse(x, y, look.nut.w, look.nut.h);
  }
}

function drawSprinkleGrown(ctx: ArtContext): void {
  const { g, box, colors } = ctx;
  const look = GROWN_LOOKS.sprinkle;
  const x0 = standX(box.width, look.stand.share, look.stand.minFromEdge);
  const tip = sparklerTip(box.width);
  const base = box.top + BASE_OVERLAP;
  stroke(g, look.stick.width + 3, colors.outline, 1, [
    [x0, base],
    [tip.x, tip.y],
  ]);
  stroke(g, look.stick.width, shade(colors.outline, 0.25), 1, [
    [x0, base],
    [tip.x, tip.y],
  ]);
  const palette = SPRINKLE_COLORS.map(parseHex);
  for (const pass of ['outline', 'fill'] as const) {
    for (let i = 0; i < look.rays.count; i++) {
      const a = (TWO_PI * i) / look.rays.count - Math.PI / 2;
      const len = look.rays.length * (i % 2 === 0 ? 1 : 0.62);
      const color = pass === 'outline' ? colors.outline : (palette[i % palette.length] ?? 0xffffff);
      const width = look.rays.width + (pass === 'outline' ? 3 : 0);
      stroke(g, width, color, 1, [
        [tip.x + Math.cos(a) * look.rays.inner, tip.y + Math.sin(a) * look.rays.inner],
        [
          tip.x + Math.cos(a) * (look.rays.inner + len),
          tip.y + Math.sin(a) * (look.rays.inner + len),
        ],
      ]);
    }
  }
  dot(ctx, tip.x, tip.y, look.rays.inner, 0xfff6c9);
  for (const s of look.sparks) {
    sparkle(g, tip.x + s.dx, box.top - s.up, s.r * 1.6, 0xfff27a);
  }
}

function drawCrumbGrown(ctx: ArtContext): void {
  const { g, box, colors } = ctx;
  const { chip } = GROWN_LOOKS.crumb;
  // The chip stands between the left edge and the face, smaller on a narrow layer.
  const from = box.left + chip.edgeGap;
  const to = -faceKeep(ctx, 'crumb', chip.faceGap);
  const fit = Math.min(1, (to - from) / chip.w);
  if (fit < chip.minFit) return;
  const x = (from + to) / 2;
  g.save();
  g.translateCanvas(x, chip.dy);
  g.rotateCanvas(chip.tilt);
  g.scaleCanvas(fit, fit);
  g.fillStyle(shade(colors.accent, -0.35), 1);
  g.fillRoundedRect(
    -chip.w / 2 - LINE,
    -chip.h / 2 - LINE,
    chip.w + LINE * 2,
    chip.h + LINE * 2,
    chip.corner + 1,
  );
  g.fillStyle(colors.accent, 1);
  g.fillRoundedRect(-chip.w / 2, -chip.h / 2, chip.w, chip.h, chip.corner);
  g.fillStyle(shade(colors.accent, 0.3), 0.85);
  g.fillRoundedRect(-chip.w / 2 + 5, -chip.h / 2 + 4, chip.w * 0.5, 5, 2.5);
  g.restore();
}

function drawGhostGrown(ctx: ArtContext, stage: CreatureStage): void {
  const { g, box } = ctx;
  const { bow } = GROWN_LOOKS.ghost;
  const y = box.top - bow.up + BASE_OVERLAP;
  const fill = parseHex(bow.fill);
  if (stage === 'glow') drawGhostGlow(ctx);
  for (const s of [-1, 1]) {
    outlined(
      ctx,
      [
        { x: s * 4, y: y + bow.tail * 0.2 },
        { x: s * (bow.loopW * 0.55), y: y + bow.tail * 1.9 },
        { x: s * (bow.loopW * 0.2), y: y + bow.tail * 1.7 },
      ],
      shade(fill, -0.12),
    );
  }
  for (const s of [-1, 1]) {
    outlined(
      ctx,
      [
        { x: s * 3, y },
        { x: s * bow.loopW, y: y - bow.loopH },
        { x: s * (bow.loopW + 3), y: y + bow.loopH * 0.15 },
        { x: s * bow.loopW, y: y + bow.loopH },
      ],
      fill,
    );
    glint(g, s * bow.loopW * 0.6, y - bow.loopH * 0.3, 2.2, 0.8);
  }
  dot(ctx, 0, y, bow.knot, fill);
  glint(g, -bow.knot * 0.3, y - bow.knot * 0.3, 1.8);
}

/** The lit grown Ghost: a pale inner rim, a soft veil over the body, a few twinkles. */
function drawGhostGlow(ctx: ArtContext): void {
  const { g, box } = ctx;
  const { glow } = GROWN_LOOKS.ghost;
  const tint = parseHex(glow.tint);
  const halo = parseHex(glow.halo);
  g.fillStyle(halo, 0.28);
  g.fillRoundedRect(box.innerLeft, box.innerTop, box.innerW, box.innerH, box.innerRadius);
  g.lineStyle(glow.rim, tint, glow.rimAlpha);
  g.strokeRoundedRect(
    box.innerLeft + glow.rim / 2,
    box.innerTop + glow.rim / 2,
    box.innerW - glow.rim,
    box.innerH - glow.rim,
    Math.max(0, box.innerRadius - glow.rim / 2),
  );
  const keep = faceKeep(ctx, 'ghost', 14);
  for (let i = 0; i < glow.sparks; i++) {
    const x = box.innerLeft + 24 + scatter(i, 0.3) * (box.innerW - 48);
    const y = box.innerTop + 16 + scatter(i, 0.65) * (box.innerH - 32);
    if (onFace(keep, x, y, glow.spark)) continue;
    sparkle(g, x, y, glow.spark * (0.7 + 0.5 * scatter(i, 0.1)), PALETTE.textLight);
  }
}

function drawTwinsGrown(ctx: ArtContext): void {
  const { g, box } = ctx;
  const look = GROWN_LOOKS.twins;
  const recipe = faceRecipe('twins', true);
  const pair = recipe.pair;
  if (!pair) return;
  const layout = faceLayout(box.width, recipe);
  const reach = Math.min(1, Math.max(0.55, layout.scale));
  [-1, 1].forEach((side, i) => {
    const x = side * layout.scale * pair.spread;
    const fill = parseHex(look.colors[i] ?? look.colors[0]);
    const baseY = box.top + look.cap.up;
    const rx = look.cap.rx * reach;
    const ry = look.cap.ry * reach;
    outlined(ctx, dome(x, baseY, rx, ry), fill);
    g.fillStyle(shade(fill, -0.16), 1);
    g.fillRoundedRect(x - rx - LINE, baseY - look.cap.brim / 2, (rx + LINE) * 2, look.cap.brim, 4);
    g.lineStyle(2, outlineColor(fill), 1);
    g.strokeRoundedRect(
      x - rx - LINE,
      baseY - look.cap.brim / 2,
      (rx + LINE) * 2,
      look.cap.brim,
      4,
    );
    dot(ctx, x, baseY - ry - look.cap.pom * 0.4, look.cap.pom * reach, shade(fill, 0.3));
    glint(g, x - rx * 0.4, baseY - ry * 0.6, 3 * reach, 0.7);
  });
}

function drawLemonGrown(ctx: ArtContext): void {
  const { g, box, colors } = ctx;
  const look = GROWN_LOOKS.lemon;
  const x0 = standX(box.width, look.stand.share, look.stand.minFromEdge);
  const base = box.top - look.canopy.up;
  const { rx, ry, wedges } = look.canopy;
  stroke(g, look.handle.width + 3, colors.outline, 1, [
    [x0, base],
    [x0, box.top + look.handle.up],
  ]);
  stroke(g, look.handle.width, colors.detail, 1, [
    [x0, base],
    [x0, box.top + look.handle.up],
  ]);
  outlined(ctx, dome(x0, base, rx, ry), colors.glaze);
  for (let k = 0; k < wedges; k++) {
    if (k % 2 === 0) continue;
    const pts: Pt[] = [{ x: x0, y: base - ry + 1 }];
    const from = Math.PI * (1 - k / wedges);
    const to = Math.PI * (1 - (k + 1) / wedges);
    for (let i = 0; i <= ARC_STEPS; i++) {
      const a = from + ((to - from) * i) / ARC_STEPS;
      pts.push({ x: x0 + rx * Math.cos(a) * 0.97, y: base - ry * Math.sin(a) * 0.97 });
    }
    g.fillStyle(colors.accent, 1);
    fillPolygon(g, pts);
  }
  for (let k = 1; k < wedges; k++) {
    const a = Math.PI * (1 - k / wedges);
    stroke(g, 2, colors.outline, 0.8, [
      [x0, base - ry + 1],
      [x0 + rx * Math.cos(a), base - ry * Math.sin(a)],
    ]);
  }
  g.fillStyle(colors.outline, 1);
  g.fillCircle(x0, base - ry, 3);
  for (const s of look.splash) {
    const x = Math.max(box.left + s.r + 2, Math.min(box.right - s.r - 2, x0 + s.dx));
    dot(ctx, x, box.top - s.up + BASE_OVERLAP, s.r, colors.glaze, 2);
  }
}

function drawRainbowGrown(ctx: ArtContext): void {
  const { g, box } = ctx;
  const look = GROWN_LOOKS.rainbow;
  const { star } = RAINBOW_LOOK;
  const side = look.sideStars;
  for (const s of [-1, 1]) {
    fillOutlinedPolygon(
      g,
      starPoints(s * side.dx, box.top - side.up + BASE_OVERLAP, side.r, star.notch),
      star.color,
      outlineColor(star.color),
      star.outline / 2,
    );
  }
  const keep = faceKeep(ctx, 'rainbow', look.trail.faceGap);
  const top = box.innerTop + box.height * 0.3;
  const { count, size } = look.trail;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = box.innerLeft + 28 + t * (box.innerW - 56);
    const y = box.innerBottom - 18 - t * (box.innerBottom - 18 - top) + Math.sin(i * 1.7) * 8;
    const r = size * (0.6 + 0.8 * scatter(i, 0.2));
    if (onFace(keep, x, y, r)) continue;
    const band = RAINBOW_BAND_COLORS[i % RAINBOW_BAND_COLORS.length] ?? 0xffffff;
    g.fillStyle(band, 0.4);
    g.fillCircle(x, y, r * 1.7);
    sparkle(g, x, y, r * 1.5, PALETTE.textLight);
  }
}

/** Draws the details of the grown look over a creature layer drawn as usual. */
export function drawGrownLook(ctx: ArtContext, creature: CreatureId, stage: CreatureStage): void {
  switch (creature) {
    case 'honey':
      return drawHoneyGrown(ctx);
    case 'puff':
      return drawPuffGrown(ctx);
    case 'jelly':
      return drawJellyGrown(ctx);
    case 'caramel':
      return drawCaramelGrown(ctx);
    case 'frosty':
      return drawFrostyGrown(ctx);
    case 'brownie':
      return drawBrownieGrown(ctx);
    case 'sprinkle':
      return drawSprinkleGrown(ctx);
    case 'crumb':
      return drawCrumbGrown(ctx);
    case 'ghost':
      return drawGhostGrown(ctx, stage);
    case 'twins':
      return drawTwinsGrown(ctx);
    case 'lemon':
      return drawLemonGrown(ctx);
    case 'rainbow':
      return drawRainbowGrown(ctx);
  }
}

/**
 * Edits the finished picture of a grown creature: the bite out of the Crumb's corner is a piece
 * cut out of the picture (`cx`, `cy` is the centre of the layer body on the canvas).
 */
export function finishGrownLook(
  context: CanvasRenderingContext2D,
  creature: CreatureId,
  width: number,
  cx: number,
  cy: number,
): void {
  if (creature !== 'crumb') return;
  const look = GROWN_LOOKS.crumb;
  const box = layerBox(width);
  const corner = { x: cx + box.right, y: cy + box.top };
  const colors = creatureColors('crumb');
  const outline = cssColor(colors.outline);
  const flesh = cssColor(colors.sponge);
  const arc = (b: { dx: number; dy: number; r: number }): void => {
    context.beginPath();
    context.arc(corner.x + b.dx, corner.y + b.dy, b.r, 0, TWO_PI);
  };
  context.save();
  context.globalCompositeOperation = 'destination-out';
  context.fillStyle = '#000000';
  for (const b of look.bite) {
    arc(b);
    context.fill();
  }
  context.globalCompositeOperation = 'source-atop';
  context.strokeStyle = flesh;
  context.lineWidth = (look.biteRim + look.biteInner) * 2;
  for (const b of look.bite) {
    arc(b);
    context.stroke();
  }
  context.strokeStyle = outline;
  context.lineWidth = look.biteRim * 2;
  for (const b of look.bite) {
    arc(b);
    context.stroke();
  }
  context.restore();
}
