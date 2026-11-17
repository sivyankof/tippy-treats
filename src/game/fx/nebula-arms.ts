import type * as Phaser from 'phaser';
import { BALANCE } from '../../data/balance';
import { PLAIN_LAYER } from '../../data/plain-layers';
import { RULE_ANIM } from '../../data/rule-anim';
import { mixColor } from '../../util/color';
import { smoothstep, TWO_PI } from '../../util/math';
import { ditherNoise } from '../objects/backdrop/sky-gradient';
import { deferStep } from '../ui/bake-texture';
import { riseRoom } from './cloud-figure';

/**
 * The nebula of the Space zone: two glowing arms of a nebula that wind round each other across the
 * flying row and cross in the middle, on the row. Three pictures in one texture of its own, frames of
 * the figure size (centre on the row): the veil (an even haze over the row that mutes the layer the
 * same everywhere, the faint halo, two haze arcs, the blue arm's shade is not here), and the two arms,
 * drawn additively over it. Everything is computed into pixels (smooth fall-offs with a little alpha
 * noise, no outline, no steps), in slices of rows, at run load.
 */

const cfg = RULE_ANIM.cloud;
const figure = cfg.figure;
const N = cfg.nebula;
const ARMS = N.arms;
const W = figure.width;
const H = figure.height;
const CX = W / 2;
const CY = H / 2;

/** Smooth 0..1 as `x` goes from `a` to `b`. */
function ramp(a: number, b: number, x: number): number {
  return b > a ? smoothstep((x - a) / (b - a)) : x >= a ? 1 : 0;
}

export const NEBULA_FRAMES = { veil: 'veil', blue: 'blue', pink: 'pink' } as const;

/** Half of the cover row, baked px from the figure centre: the layer with its bob and margin. */
export const ROW_HALF = (BALANCE.layer.height / 2 + cfg.bobPx + figure.layerMargin) / figure.scale;

type ArmName = 'pink' | 'blue';
type ArmSpec = (typeof ARMS)[ArmName];

/** A sample of an arm, baked px from the figure centre (unsquashed): its half width and how far it turned to its end tone, 0..1. */
export interface ArmPoint {
  x: number;
  y: number;
  w: number;
  end: number;
}

/** The pink arm runs up on the left and down on the right; the blue one the other way round (antiphase). */
const SIGN: Record<ArmName, number> = { pink: 1, blue: -1 };
/** How the ends turn: the pink arm curls one way (heading angle falls), the blue one hooks the other. */
const CURL: Record<ArmName, number> = { pink: -1, blue: 1 };

/** The axis of an arm at `u` px from the centre (y down), inside its reach. */
export function armAxisY(arm: ArmName, u: number): number {
  const s = ARMS[arm];
  return SIGN[arm] * -s.amplitude * Math.sin((Math.PI * u) / s.reach);
}

/** The slope dy/du of the axis of an arm at `u`. */
function armSlope(arm: ArmName, u: number): number {
  const s = ARMS[arm];
  return ((SIGN[arm] * -s.amplitude * Math.PI) / s.reach) * Math.cos((Math.PI * u) / s.reach);
}

/** Half width of an arm at `u`: widest in the middle, tapering to the ends. */
export function armWidth(arm: ArmName, u: number): number {
  const [middle, end] = ARMS[arm].width;
  const k = Math.min(1, (u / ARMS[arm].reach) ** 2);
  return middle + (end - middle) * k;
}

/** A curl at an arm end: from (`x`, `y`) heading `heading`, it turns `curl`-wise, tighter and thinner as it goes. */
function curlFrom(
  spec: ArmSpec,
  x: number,
  y: number,
  heading: number,
  width: number,
  curl: number,
): ArmPoint[] {
  const e = spec.end;
  const total = e.turns * TWO_PI;
  const pts: ArmPoint[] = [];
  let turned = 0;
  let a = heading;
  let px = x;
  let py = y;
  while (turned < total) {
    const k = turned / total;
    const rho = e.radius * (1 - (1 - e.tighten) * k);
    const da = ARMS.step / rho;
    a += curl * da;
    turned += da;
    px += Math.cos(a) * ARMS.step;
    py += Math.sin(a) * ARMS.step;
    pts.push({
      x: px,
      y: py,
      w: width * (1 - (1 - e.endWidth) * k),
      end: e.from < 1 ? 0.5 + 0.5 * ramp(0, 0.5, k) : 0,
    });
  }
  return pts;
}

/** The samples of an arm, from its left end curl through the wave to its right end curl. */
export function armPoints(arm: ArmName): { main: ArmPoint[]; left: ArmPoint[]; right: ArmPoint[] } {
  const s = ARMS[arm];
  const main: ArmPoint[] = [];
  for (let u = -s.reach; u <= s.reach;) {
    const along = Math.abs(u) / s.reach;
    main.push({
      x: u,
      y: armAxisY(arm, u),
      w: armWidth(arm, u),
      end: s.end.from < 1 ? 0.5 * ramp(s.end.from, 1, along) : 0,
    });
    u += ARMS.step / Math.hypot(1, armSlope(arm, u));
  }
  const slope = armSlope(arm, s.reach);
  const endW = armWidth(arm, s.reach);
  const right = curlFrom(s, s.reach, armAxisY(arm, s.reach), Math.atan2(slope, 1), endW, CURL[arm]);
  // The left end is the right one turned half round the centre (the wave is odd): same turning sense.
  const left = right.map((p) => ({ ...p, x: -p.x, y: -p.y }));
  return { main, left, right };
}

/** The total turn of a curl, in turns (1.5 for the pink spirals). */
export function curlTurns(pts: readonly ArmPoint[], start: number): number {
  let turned = 0;
  let prev = start;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (!a || !b) continue;
    const h = Math.atan2(b.y - a.y, b.x - a.x);
    let d = h - prev;
    while (d > Math.PI) d -= TWO_PI;
    while (d < -Math.PI) d += TWO_PI;
    turned += d;
    prev = h;
  }
  return turned / TWO_PI;
}

function allPoints(arm: ArmName): ArmPoint[] {
  const { main, left, right } = armPoints(arm);
  return [...left, ...main, ...right];
}

/** How far up (and down) from the centre the drawing reaches, unsquashed, baked px. */
export function designReach(): number {
  let reach = Math.max(N.halo.ry, N.arcs.y + N.arcs.width / 2 + N.arcs.soft, N.core.radius);
  for (const arm of ['pink', 'blue'] as const) {
    for (const p of allPoints(arm)) reach = Math.max(reach, Math.abs(p.y) + ARMS.glow * p.w);
  }
  return reach;
}

/**
 * How far above the centre the nebula may reach on a screen `screenH` tall, baked px: as far as the
 * HUD gap allows at the highest bob (`riseRoom`), and never less than the cloud's flattened top on the
 * shortest screen (the body top and the outline; the gap to the plates there is the accepted one).
 */
export function nebulaHeadroom(screenH: number): number {
  const least = H / 2 - figure.body.top + figure.outline;
  return Math.max(least, least + riseRoom(screenH));
}

/** The vertical squash of the drawing on a screen `screenH` tall (1 keeps it): the veil's fade and everything else fit the headroom. */
export function nebulaSquash(screenH: number): number {
  const room = nebulaHeadroom(screenH);
  return Math.min(1, room / designReach(), (room - ROW_HALF) / N.veil.fade);
}

/** How far above the centre the drawing reaches with squash `v`, baked px. */
export function nebulaTop(v: number): number {
  return Math.max(designReach() * v, ROW_HALF + N.veil.fade * v);
}

/** Opacity of the veil in its picture at (`u`, `y`) px from the centre with squash `v`: 1 over the whole cover row. */
export function veilAlpha(u: number, y: number, v: number): number {
  const b = figure.body;
  const x = u + CX;
  const outX = Math.max(b.left - x, x - b.right, 0);
  const outY = Math.max(Math.abs(y) - ROW_HALF, 0);
  return (1 - ramp(0, N.veil.fade * v, outY)) * (1 - ramp(0, N.veil.fadeX, outX));
}

/** Premultiplied paint: layers are put over one another like paint ("over"). */
interface Paint {
  r: number;
  g: number;
  b: number;
  a: number;
}

function over(p: Paint, color: number, alpha: number): void {
  if (alpha <= 0) return;
  const k = 1 - alpha;
  p.r = p.r * k + ((color >> 16) & 255) * alpha;
  p.g = p.g * k + ((color >> 8) & 255) * alpha;
  p.b = p.b * k + (color & 255) * alpha;
  p.a = p.a * k + alpha;
}

function put(out: Uint8ClampedArray, at: number, p: Paint, x: number, y: number): void {
  if (p.a <= 0) return;
  const a = Math.min(1, p.a + ditherNoise(x, y) / 255);
  out[at] = p.r / p.a;
  out[at + 1] = p.g / p.a;
  out[at + 2] = p.b / p.a;
  out[at + 3] = a * 255;
}

/** The glow tones of an arm at `n` half widths from its axis, `end` of the way to its end tone. */
export function armPaint(spec: ArmSpec, n: number, end: number, p: Paint): void {
  const t = spec.tones;
  const G = ARMS.glow;
  if (n >= G) return;
  over(p, t.glow, 0.5 * (1 - n / G) ** 2);
  over(p, mixColor(t.middle, spec.end.tone, end), 0.85 * (1 - ramp(0.5, 1.05, n)));
  over(p, mixColor(t.core, spec.end.tone, end * 0.5), 0.9 * (1 - ramp(0.18, 0.5, n)));
  over(p, t.thread, 0.95 * (1 - ramp(0.05, 0.14, n)));
}

/** The nearest arm sample of every pixel: its distance in half widths and its end share. */
interface Field {
  n: Float32Array;
  end: Float32Array;
}

function newField(): Field {
  return { n: new Float32Array(W * H).fill(Infinity), end: new Float32Array(W * H) };
}

function stamp(field: Field, pts: readonly ArmPoint[], v: number): void {
  for (const p of pts) {
    const px = CX + p.x;
    const py = CY + p.y * v;
    const reach = ARMS.glow * p.w;
    const x0 = Math.max(0, Math.floor(px - reach));
    const x1 = Math.min(W - 1, Math.ceil(px + reach));
    const y0 = Math.max(0, Math.floor(py - reach * v));
    const y1 = Math.min(H - 1, Math.ceil(py + reach * v));
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - py) / v;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - px;
        const n = Math.sqrt(dx * dx + dy * dy) / p.w;
        const at = y * W + x;
        if (n < (field.n[at] ?? Infinity)) {
          field.n[at] = n;
          field.end[at] = p.end;
        }
      }
    }
  }
}

/** The veil frame: the halo, the even haze over the row, the haze arcs and the dust vein through the core. */
function paintVeil(p: Paint, u: number, y: number, v: number): void {
  const h = N.halo;
  const e2 = (u / h.rx) ** 2 + (y / (h.ry * v)) ** 2;
  if (e2 < 1) over(p, h.color, h.alpha * (1 - e2) ** 2);
  const [toneA, toneB] = N.veil.tones;
  const wave = 0.5 + 0.5 * Math.sin((TWO_PI * u) / N.veil.waveX + Math.sin(y / 40) * 0.6);
  over(p, mixColor(toneA, toneB, wave), veilAlpha(u, y, v));
  const a = N.arcs;
  const along = Math.abs(u) / a.reach;
  if (along < 1) {
    const arcY = (a.y - a.sag * along * along) * v;
    const d = Math.abs(Math.abs(y) - arcY);
    const fade = 1 - ramp(0.7, 1, along);
    over(p, a.color, a.alpha * fade * (1 - ramp(a.width / 2, a.width / 2 + a.soft, d)));
  }
  const vein = N.core.vein;
  const k = u / vein.length;
  if (Math.abs(k) < 1) {
    const veinY = (u * vein.tilt + vein.bend * Math.sin(Math.PI * k)) * v;
    const d = Math.abs(y - veinY);
    const fade = 1 - ramp(0.55, 1, Math.abs(k));
    over(p, vein.color, vein.alpha * fade * (1 - ramp(vein.width / 2, vein.width / 2 + 1.2, d)));
  }
}

/** Sprinkle colours of the layers, white left out. */
const SPRINKLE_COLORS = PLAIN_LAYER.decor.sprinkles.colors.filter((c) => c !== 0xffffff);

function css(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** The sprinkle strokes of `arm` drawn on its frame (top-left of the frame at `oy`). */
function drawSprinkles(ctx: CanvasRenderingContext2D, arm: ArmName, oy: number, v: number): void {
  const s = N.sprinkles;
  ctx.lineCap = 'round';
  ctx.lineWidth = s.width;
  s.spots.forEach((spot, i) => {
    if (spot.arm !== arm) return;
    const slope = armSlope(arm, spot.u) * v;
    const len = Math.hypot(1, slope);
    const w = armWidth(arm, spot.u) * spot.across;
    const x = CX + spot.u - (slope / len) * w;
    const y = oy + CY + armAxisY(arm, spot.u) * v + w / len;
    const a = Math.atan2(slope, 1) + spot.turn;
    const dx = (Math.cos(a) * s.length) / 2;
    const dy = (Math.sin(a) * s.length) / 2;
    ctx.strokeStyle = css(SPRINKLE_COLORS[i % SPRINKLE_COLORS.length] ?? 0xffd35c);
    ctx.beginPath();
    ctx.moveTo(x - dx, y - dy);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  });
}

/** The sparks: soft dots and small four-ray stars, white, on the pink frame. */
function drawSparks(ctx: CanvasRenderingContext2D, oy: number, v: number): void {
  for (const s of N.sparks) {
    const x = CX + s.x;
    const y = oy + CY + s.y * v;
    const dot = ctx.createRadialGradient(x, y, 0, x, y, s.r < 5 ? s.r : s.r * 0.45);
    dot.addColorStop(0, 'rgba(255,255,255,1)');
    dot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = dot;
    ctx.beginPath();
    ctx.arc(x, y, s.r < 5 ? s.r : s.r * 0.45, 0, TWO_PI);
    ctx.fill();
    if (s.r < 5) continue;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(x, y - s.r);
    ctx.quadraticCurveTo(x, y, x + s.r, y);
    ctx.quadraticCurveTo(x, y, x, y + s.r);
    ctx.quadraticCurveTo(x, y, x - s.r, y);
    ctx.quadraticCurveTo(x, y, x, y - s.r);
    ctx.fill();
  }
}

/** The squash each nebula texture was baked with: it is baked again when the screen asks for another. */
const bakedSquash = new Map<string, number>();

/** Rows of pixels painted per deferred step. */
const ROWS_PER_STEP = 24;
/** Arm samples stamped per deferred step. */
const POINTS_PER_STEP = 160;

/**
 * Bakes the nebula for a screen `screenH` tall into texture `key` (frames `NEBULA_FRAMES`), in deferred
 * steps when called inside `collectBakeSteps`. A texture baked for another squash is replaced (only at
 * run load, when nothing shows it).
 */
export function bakeNebulaArms(scene: Phaser.Scene, key: string, screenH: number): void {
  const v = nebulaSquash(screenH);
  if (scene.textures.exists(key)) {
    if (bakedSquash.get(key) === v) return;
    scene.textures.remove(key);
  }
  bakedSquash.set(key, v);
  const fields = { pink: newField(), blue: newField() };
  for (const arm of ['pink', 'blue'] as const) {
    const pts = allPoints(arm);
    for (let i = 0; i < pts.length; i += POINTS_PER_STEP) {
      const slice = pts.slice(i, i + POINTS_PER_STEP);
      deferStep(() => stamp(fields[arm], slice, v));
    }
  }
  const pixels = new Uint8ClampedArray(new ArrayBuffer(W * H * 3 * 4));
  const shade = ARMS.shade;
  const core = N.core;
  const p: Paint = { r: 0, g: 0, b: 0, a: 0 };
  for (let from = 0; from < H; from += ROWS_PER_STEP) {
    const to = Math.min(from + ROWS_PER_STEP, H);
    deferStep(() => {
      for (let y = from; y < to; y++) {
        const dy = y + 0.5 - CY;
        const shadeRow = Math.max(0, Math.round(y - shade.drop * v));
        for (let x = 0; x < W; x++) {
          const u = x + 0.5 - CX;
          const at = y * W + x;
          p.r = p.g = p.b = p.a = 0;
          paintVeil(p, u, dy, v);
          put(pixels, at * 4, p, x, y);
          // The blue arm, shaded where the pink one passes over it.
          p.r = p.g = p.b = p.a = 0;
          armPaint(ARMS.blue, fields.blue.n[at] ?? Infinity, 0, p);
          const pinkOver = fields.pink.n[shadeRow * W + x] ?? Infinity;
          const shaded = 1 - shade.alpha * (1 - ramp(0.6, shade.reach, pinkOver));
          const blueA = ARMS.blue.alpha * shaded;
          p.r *= blueA;
          p.g *= blueA;
          p.b *= blueA;
          p.a *= blueA;
          put(pixels, (W * H + at) * 4, p, x, y);
          // The pink arm and the warm core over the crossing.
          p.r = p.g = p.b = p.a = 0;
          armPaint(ARMS.pink, fields.pink.n[at] ?? Infinity, fields.pink.end[at] ?? 0, p);
          p.r *= ARMS.pink.alpha;
          p.g *= ARMS.pink.alpha;
          p.b *= ARMS.pink.alpha;
          p.a *= ARMS.pink.alpha;
          const c = Math.hypot(u, dy / v) / core.radius;
          if (c < 1) over(p, core.color, core.alpha * (1 - c) ** 1.6);
          put(pixels, (2 * W * H + at) * 4, p, x, y);
        }
      }
    });
  }
  deferStep(() => {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H * 3;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.putImageData(new ImageData(pixels, W, H * 3), 0, 0);
    drawSprinkles(ctx, 'blue', H, v);
    drawSprinkles(ctx, 'pink', 2 * H, v);
    drawSparks(ctx, 2 * H, v);
    const texture = scene.textures.addCanvas(key, canvas);
    if (!texture) return;
    texture.add(NEBULA_FRAMES.veil, 0, 0, 0, W, H);
    texture.add(NEBULA_FRAMES.blue, 0, 0, H, W, H);
    texture.add(NEBULA_FRAMES.pink, 0, 0, 2 * H, W, H);
  });
}
