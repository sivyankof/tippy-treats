import type * as Phaser from 'phaser';
import { ANIM } from '../../data/common/anim';
import { BALANCE } from '../../data/tower/balance';
import { PLAIN_LAYER } from '../../data/tower/plain-layers';
import { RULE_ANIM } from '../../data/zones/rule-anim';
import { channels, cssColor, mixColor } from '../../util/color';
import { clamp01, rampBetween, TWO_PI } from '../../util/math';
import { ditherNoise } from '../objects/backdrop/sky-gradient';
import { deferStep } from '../ui/bake-texture';
import { createCpuCanvas } from '../ui/cpu-canvas';
import { riseRoom } from './cloud-figure';

/**
 * The nebula of the Space zone: two glowing arms of a nebula that wind round each other across the
 * flying row and cross in the middle, on the row. Three pictures (frames of one texture of its own, each
 * cut to what it holds, placed by the figure centre): the veil (an even haze over the row that mutes the
 * layer the same everywhere and melts away above and below as a faint lilac glow, with the halo, the haze
 * arcs, the warm core, the dust vein and the shadow of the pink arm), and the two arms, drawn additively
 * over it. Every pixel is computed once (the nearest point of each arm: Newton steps on the wave, a short
 * polyline on the curls), with smooth fall-offs and a little alpha noise: no outline, no steps.
 */

const cfg = RULE_ANIM.cloud;
const figure = cfg.figure;
const N = cfg.nebula;
const ARMS = N.arms;
const W = figure.width;
const H = figure.height;
const CX = W / 2;
const CY = H / 2;

export const NEBULA_FRAMES = { veil: 'veil', blue: 'blue', pink: 'pink' } as const;
export type NebulaFrame = keyof typeof NEBULA_FRAMES;

/** Half of the cover row, baked px from the figure centre: the layer with its bob and margin. */
export const ROW_HALF = (BALANCE.layer.height / 2 + cfg.bobPx + figure.layerMargin) / figure.scale;

/** Half of the layer itself with both bobs (its own and the figure's), baked px from the figure centre. */
export const LAYER_HALF =
  (BALANCE.layer.height / 2 + cfg.bobPx + ANIM.flying.bobAmplitude) / figure.scale;

export type ArmName = 'pink' | 'blue';
type ArmSpec = (typeof ARMS)[ArmName];
const ARM_NAMES: readonly ArmName[] = ['blue', 'pink'];

/** The pink arm runs one way, the blue one the other (antiphase). */
const SIGN: Record<ArmName, number> = { pink: 1, blue: -1 };
/** How the ends turn: the pink arm curls one way (heading angle falls), the blue one hooks the other. */
const CURL: Record<ArmName, number> = { pink: -1, blue: 1 };

/** How the drawing is laid out on a screen: the wave and curls lower on a short screen, the arms as wide. */
export interface NebulaLayout {
  /** Share of the full wave height, 0..1 (1 on tall screens). */
  fit: number;
  /** How far above the centre the drawing may reach, baked px. */
  room: number;
  amplitude: Record<ArmName, number>;
  curlRadius: Record<ArmName, number>;
  /** How far the glow reaches, in half widths of the arm. */
  glow: number;
  /** Share of the arms' light: the low arms of a short screen lie over the row and are a little dimmer. */
  light: number;
  arcY: number;
  haloRy: number;
  /** The veil is opaque up to this far from the centre (the cover row, or the layer itself on a short screen). */
  veilCore: number;
  veilFade: number;
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

function layoutAt(fit: number, room: number): NebulaLayout {
  const l = N.layout;
  const curl = l.curlFloor + (1 - l.curlFloor) * fit;
  // On a short screen the bank may stand up to the layer's bob lower (`verticalRoom`): the opaque core
  // still holds the whole layer then.
  const core = LAYER_HALF + ANIM.flying.bobAmplitude / figure.scale;
  const veilCore = room - ROW_HALF >= l.minFade ? ROW_HALF : Math.max(core, room - l.minFade);
  return {
    fit,
    room,
    amplitude: { pink: ARMS.pink.amplitude * fit, blue: ARMS.blue.amplitude * fit },
    curlRadius: { pink: ARMS.pink.end.radius * curl, blue: ARMS.blue.end.radius * curl },
    glow: ARMS.glow * (l.glowFloor + (1 - l.glowFloor) * fit * fit),
    light: l.lightFloor + (1 - l.lightFloor) * fit,
    arcY: Math.min(N.arcs.y, room - N.arcs.width / 2 - N.arcs.soft),
    haloRy: Math.min(N.halo.ry, room),
    veilCore,
    veilFade: Math.max(0, Math.min(N.veil.fade, room - veilCore)),
  };
}

/** The layout for a screen `screenH` tall: the full drawing if it fits the headroom, else the highest wave that does. */
export function nebulaLayout(screenH: number): NebulaLayout {
  const room = nebulaHeadroom(screenH);
  const full = layoutAt(1, room);
  if (armsReach(full) <= room) return full;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (armsReach(layoutAt(mid, room)) <= room) lo = mid;
    else hi = mid;
  }
  return layoutAt(lo, room);
}

/** How far the stars and sparks sit from the row with this layout, as a share of their full offset. */
export function nebulaYScale(layout: NebulaLayout): number {
  return 0.4 + 0.6 * layout.fit;
}

/** The axis of an arm at `u` px from the centre (y down), inside its reach. */
export function armAxisY(arm: ArmName, u: number, layout: NebulaLayout): number {
  return -SIGN[arm] * layout.amplitude[arm] * Math.sin((Math.PI * u) / ARMS[arm].reach);
}

function armSlope(arm: ArmName, u: number, layout: NebulaLayout): number {
  const k = Math.PI / ARMS[arm].reach;
  return -SIGN[arm] * layout.amplitude[arm] * k * Math.cos(k * u);
}

/** Half width of an arm at `u`: widest in the middle, tapering to the ends (the same on every screen). */
export function armWidth(arm: ArmName, u: number): number {
  const [middle, end] = ARMS[arm].width;
  const k = Math.min(1, (u / ARMS[arm].reach) ** 2);
  return middle + (end - middle) * k;
}

/** How far the main run of an arm at `u` has turned to its end tone (the spirals finish the turn). */
function mainEnd(spec: ArmSpec, u: number): number {
  return spec.end.from < 1 ? 0.5 * rampBetween(Math.abs(u) / spec.reach, spec.end.from, 1) : 0;
}

/** A sample of an arm, baked px from the figure centre: its half width and how far it turned to its end tone, 0..1. */
export interface ArmPoint {
  x: number;
  y: number;
  w: number;
  end: number;
}

/** A curl at an arm end: from `start` heading `heading`, it turns `curl`-wise, tighter and thinner as it goes. */
function curlFrom(
  spec: ArmSpec,
  start: ArmPoint,
  heading: number,
  curl: number,
  radius: number,
): ArmPoint[] {
  const e = spec.end;
  const total = e.turns * TWO_PI;
  const pts: ArmPoint[] = [];
  let turned = 0;
  let a = heading;
  let { x, y } = start;
  while (turned < total) {
    const k = turned / total;
    const rho = radius * (1 - (1 - e.tighten) * k);
    const da = ARMS.step / rho;
    a += curl * da;
    turned += da;
    x += Math.cos(a) * ARMS.step;
    y += Math.sin(a) * ARMS.step;
    pts.push({
      x,
      y,
      w: start.w * (1 - (1 - e.endWidth) * k),
      end: e.from < 1 ? 0.5 + 0.5 * rampBetween(k, 0, 0.5) : 0,
    });
  }
  return pts;
}

/** The samples of an arm: its wave and its two end curls. */
export interface ArmSamples {
  main: ArmPoint[];
  left: ArmPoint[];
  right: ArmPoint[];
}

/** The samples of each arm made for a layout (a layout is made once per screen and kept). */
const armCache = new WeakMap<NebulaLayout, Partial<Record<ArmName, ArmSamples>>>();

/** The samples of an arm for a layout, made once (the left curl is the right one turned half round). */
export function armPoints(arm: ArmName, layout: NebulaLayout): ArmSamples {
  let byArm = armCache.get(layout);
  if (!byArm) {
    byArm = {};
    armCache.set(layout, byArm);
  }
  const cached = byArm[arm];
  if (cached) return cached;
  const made = makeArmPoints(arm, layout);
  byArm[arm] = made;
  return made;
}

function makeArmPoints(arm: ArmName, layout: NebulaLayout): ArmSamples {
  const s = ARMS[arm];
  const main: ArmPoint[] = [];
  for (let u = -s.reach; u <= s.reach;) {
    main.push({ x: u, y: armAxisY(arm, u, layout), w: armWidth(arm, u), end: mainEnd(s, u) });
    u += ARMS.step / Math.hypot(1, armSlope(arm, u, layout));
  }
  const end: ArmPoint = {
    x: s.reach,
    y: armAxisY(arm, s.reach, layout),
    w: armWidth(arm, s.reach),
    end: mainEnd(s, s.reach),
  };
  const heading = Math.atan2(armSlope(arm, s.reach, layout), 1);
  const right = curlFrom(s, end, heading, CURL[arm], layout.curlRadius[arm]);
  const left = right.map((p) => ({ ...p, x: -p.x, y: -p.y }));
  return { main, left, right };
}

/** The total turn of a curl, in turns, from the heading `start`. */
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

/** How far the sway turns the arms round the centre at most (`nebula.motion.swayRad`; the blue one turns less). */
const SWAY_SIN = Math.sin(N.motion.swayRad);

/** How far up (and down) from the centre the arms with their glow reach, baked px, their sway included. */
export function armsReach(layout: NebulaLayout): number {
  let reach = 0;
  for (const arm of ARM_NAMES) {
    const { main, left, right } = armPoints(arm, layout);
    for (const p of [...left, ...main, ...right]) {
      reach = Math.max(reach, Math.abs(p.y) + layout.glow * p.w + Math.abs(p.x) * SWAY_SIN);
    }
  }
  return reach;
}

/** How far above the centre the whole drawing reaches with this layout, baked px. */
export function nebulaTop(layout: NebulaLayout): number {
  return Math.max(
    armsReach(layout),
    layout.haloRy,
    layout.veilCore + layout.veilFade,
    layout.arcY + N.arcs.width / 2 + N.arcs.soft,
  );
}

/** How the reach of the veil's fringe swells along the row, 0..1 (top and bottom out of step). */
function fringeWave(u: number, top: boolean): number {
  const v = N.veil;
  return (
    0.5 + 0.5 * Math.sin((TWO_PI * u) / v.waveX + (top ? 0 : Math.PI) + 0.7 * Math.sin(u / 97))
  );
}

/**
 * Opacity of the veil in its picture at (`u`, `y`) px from the centre: 1 over the whole cover row (on a
 * short screen over the layer itself), so the layer is muted the same everywhere, melting away above and
 * below over a reach that swells along the row.
 */
export function veilAlpha(u: number, y: number, layout: NebulaLayout): number {
  const b = figure.body;
  const x = u + CX;
  const outX = Math.max(b.left - x, x - b.right, 0);
  const sideX = 1 - rampBetween(outX, 0, N.veil.fadeX);
  const out = Math.abs(y) - layout.veilCore;
  if (out <= 0) return sideX;
  const reach = layout.veilFade * (N.veil.fadeMin + (1 - N.veil.fadeMin) * fringeWave(u, y < 0));
  if (reach <= 0) return 0;
  return sideX * (1 - rampBetween(out, 0, reach)) ** 2;
}

/** Where a picture is cut from the figure frame, figure px. */
export interface FrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where each picture is cut from the figure frame: only as big as what it holds (less to fill on screen). */
export function nebulaFrameRects(layout: NebulaLayout): Record<NebulaFrame, FrameRect> {
  const veilTop = Math.ceil(Math.max(nebulaTop(layout), N.core.radius)) + 2;
  const veil = { x: 0, y: Math.max(0, CY - veilTop), w: W, h: Math.min(H, veilTop * 2) };
  const yScale = nebulaYScale(layout);
  const cut = (arm: ArmName): FrameRect => {
    const { main, left, right } = armPoints(arm, layout);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of [...left, ...main, ...right]) {
      const r = layout.glow * p.w;
      x0 = Math.min(x0, p.x - r);
      x1 = Math.max(x1, p.x + r);
      y0 = Math.min(y0, p.y - r);
      y1 = Math.max(y1, p.y + r);
    }
    if (arm === 'pink') {
      for (const s of N.sparks) {
        y0 = Math.min(y0, s.y * yScale - s.r);
        y1 = Math.max(y1, s.y * yScale + s.r);
      }
    }
    const left0 = Math.max(0, Math.floor(CX + x0) - 3);
    const top0 = Math.max(0, Math.floor(CY + y0) - 3);
    return {
      x: left0,
      y: top0,
      w: Math.min(W, Math.ceil(CX + x1) + 3) - left0,
      h: Math.min(H, Math.ceil(CY + y1) + 3) - top0,
    };
  };
  return { veil, blue: cut('blue'), pink: cut('pink') };
}

/** The origin that puts the figure centre of a picture cut by `rect` where the figure's centre is. */
export function frameOrigin(rect: FrameRect): { x: number; y: number } {
  return { x: (CX - rect.x) / rect.w, y: (CY - rect.y) / rect.h };
}

// ---- Pixels ----------------------------------------------------------------------------------------

/** Premultiplied paint: layers are put over one another like paint ("over"). */
interface Paint {
  r: number;
  g: number;
  b: number;
  a: number;
}

type Rgb = readonly [number, number, number];

const rgb = channels;

function over(p: Paint, c: Rgb, alpha: number): void {
  if (alpha <= 0) return;
  const k = 1 - alpha;
  p.r = p.r * k + c[0] * alpha;
  p.g = p.g * k + c[1] * alpha;
  p.b = p.b * k + c[2] * alpha;
  p.a = p.a * k + alpha;
}

/** `over` with the colour mixed from `a` to `b` by `t`. */
function overMix(p: Paint, a: Rgb, b: Rgb, t: number, alpha: number): void {
  if (alpha <= 0) return;
  const k = 1 - alpha;
  p.r = p.r * k + (a[0] + (b[0] - a[0]) * t) * alpha;
  p.g = p.g * k + (a[1] + (b[1] - a[1]) * t) * alpha;
  p.b = p.b * k + (a[2] + (b[2] - a[2]) * t) * alpha;
  p.a = p.a * k + alpha;
}

function scalePaint(p: Paint, k: number): void {
  p.r *= k;
  p.g *= k;
  p.b *= k;
  p.a *= k;
}

function put(out: Uint8ClampedArray, at: number, p: Paint, x: number, y: number): void {
  if (p.a <= 0) return;
  const a = Math.min(1, p.a + ditherNoise(x, y) / 255);
  out[at] = p.r / p.a;
  out[at + 1] = p.g / p.a;
  out[at + 2] = p.b / p.a;
  out[at + 3] = a * 255;
}

/** The tones of an arm as channels. */
interface ArmTones {
  glow: Rgb;
  middle: Rgb;
  core: Rgb;
  thread: Rgb;
  end: Rgb;
}

function armTones(spec: ArmSpec): ArmTones {
  const t = spec.tones;
  return {
    glow: rgb(t.glow),
    middle: rgb(t.middle),
    core: rgb(t.core),
    thread: rgb(t.thread),
    end: rgb(spec.end.tone),
  };
}

/** The glow tones of an arm at `n` half widths from its axis, `end` of the way to its end tone; `glow` the reach. */
function armPaint(tones: ArmTones, n: number, end: number, glow: number, p: Paint): void {
  if (n >= glow) return;
  over(p, tones.glow, 0.5 * (1 - n / glow) ** 2);
  overMix(p, tones.middle, tones.end, end, 0.85 * (1 - rampBetween(n, 0.5, 1.05)));
  overMix(p, tones.core, tones.end, end * 0.5, 0.9 * (1 - rampBetween(n, 0.18, 0.5)));
  over(p, tones.thread, 0.95 * (1 - rampBetween(n, 0.05, 0.14)));
}

/** The nearest point of an arm found for a pixel: its distance in half widths and its end share. */
interface Hit {
  n: number;
  end: number;
}

/** A curl as short segments with its bounds (glow included), for the nearest-point search. */
interface CurlPath {
  pts: ArmPoint[];
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Every this many samples make one segment of a curl's polyline (about 6 px). */
const CURL_STRIDE = 4;

function curlPath(pts: readonly ArmPoint[], glow: number, start: ArmPoint): CurlPath {
  const kept = [start, ...pts.filter((_, i) => i % CURL_STRIDE === CURL_STRIDE - 1)];
  const last = pts[pts.length - 1];
  if (last && kept[kept.length - 1] !== last) kept.push(last);
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const p of kept) {
    const r = glow * p.w;
    x0 = Math.min(x0, p.x - r);
    x1 = Math.max(x1, p.x + r);
    y0 = Math.min(y0, p.y - r);
    y1 = Math.max(y1, p.y + r);
  }
  return { pts: kept, x0, x1, y0, y1 };
}

/** One arm ready to be searched: its wave and its two curls. */
interface ArmShape {
  arm: ArmName;
  curls: CurlPath[];
}

function armShape(arm: ArmName, layout: NebulaLayout): ArmShape {
  const { main, left, right } = armPoints(arm, layout);
  const first = main[0];
  const last = main[main.length - 1];
  const curls: CurlPath[] = [];
  if (last) curls.push(curlPath(right, layout.glow, last));
  if (first) curls.push(curlPath(left, layout.glow, first));
  return { arm, curls };
}

/** Finds the nearest point of an arm to (`x`, `y`) (from the centre): Newton steps on the wave, segments on the curls. */
function nearest(shape: ArmShape, layout: NebulaLayout, x: number, y: number, hit: Hit): void {
  hit.n = Infinity;
  hit.end = 0;
  const arm = shape.arm;
  const spec = ARMS[arm];
  const reach = spec.reach;
  const amp = -SIGN[arm] * layout.amplitude[arm];
  const k = Math.PI / reach;
  if (Math.abs(y) <= Math.abs(amp) + layout.glow * spec.width[0]) {
    let u = Math.max(-reach, Math.min(reach, x));
    for (let i = 0; i < 3; i++) {
      const sn = Math.sin(k * u);
      const f = amp * sn;
      const f1 = amp * k * Math.cos(k * u);
      const f2 = -amp * k * k * sn;
      const g = u - x + (f - y) * f1;
      const g1 = 1 + f1 * f1 + (f - y) * f2;
      if (g1 <= 1e-6) break;
      u = Math.max(-reach, Math.min(reach, u - g / g1));
    }
    const n = Math.hypot(x - u, y - amp * Math.sin(k * u)) / armWidth(arm, u);
    if (n < hit.n) {
      hit.n = n;
      hit.end = mainEnd(spec, u);
    }
  }
  for (const c of shape.curls) {
    if (x < c.x0 || x > c.x1 || y < c.y0 || y > c.y1) continue;
    for (let i = 1; i < c.pts.length; i++) {
      const a = c.pts[i - 1];
      const b = c.pts[i];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len2 = dx * dx + dy * dy;
      const t = len2 > 0 ? clamp01(((x - a.x) * dx + (y - a.y) * dy) / len2) : 0;
      const d = Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
      const n = d / (a.w + (b.w - a.w) * t);
      if (n < hit.n) {
        hit.n = n;
        hit.end = a.end + (b.end - a.end) * t;
      }
    }
  }
}

/** Everything a slice of pixels needs, made once per bake. */
interface BakeKit {
  layout: NebulaLayout;
  shapes: Record<ArmName, ArmShape>;
  tones: Record<ArmName, ArmTones>;
  /** The veil's tone at each column of the veil picture (it drifts along the row only). */
  veilTones: readonly Rgb[];
  fringe: Rgb;
  halo: Rgb;
  arc: Rgb;
  cream: Rgb;
  shade: Rgb;
  vein: Rgb;
}

function bakeKit(layout: NebulaLayout): BakeKit {
  return {
    layout,
    shapes: { pink: armShape('pink', layout), blue: armShape('blue', layout) },
    tones: { pink: armTones(ARMS.pink), blue: armTones(ARMS.blue) },
    veilTones: Array.from({ length: W }, (_, col) =>
      rgb(mixColor(N.veil.tones[0], N.veil.tones[1], fringeWave(col + 0.5 - CX, true))),
    ),
    fringe: rgb(N.veil.fringe),
    halo: rgb(N.halo.color),
    arc: rgb(N.arcs.color),
    cream: rgb(N.core.color),
    shade: rgb(ARMS.shade.color),
    vein: rgb(N.core.vein.color),
  };
}

/** How much the pink arm shades what lies behind it at (`u`, `y`): its shape moved down, near the crossing only. */
function shadeAt(kit: BakeKit, u: number, y: number, hit: Hit): number {
  const s = ARMS.shade;
  if (Math.abs(u) >= s.reach) return 0;
  nearest(kit.shapes.pink, kit.layout, u, y - s.drop, hit);
  return (
    (1 - rampBetween(hit.n, s.inner, s.outer)) *
    (1 - rampBetween(Math.abs(u), s.reach * 0.5, s.reach))
  );
}

/** How much of the arms' light is left at `c` core radii from the centre: dimmed at the crossing (no white-out). */
export function coreDim(c: number): number {
  return c >= 1 ? 1 : 1 - N.core.cap * (1 - c) ** 1.2;
}

function paintVeil(kit: BakeKit, p: Paint, u: number, y: number, hit: Hit): void {
  const L = kit.layout;
  const h = N.halo;
  const e2 = (u / h.rx) ** 2 + (L.haloRy > 0 ? (y / L.haloRy) ** 2 : Infinity);
  if (e2 < 1) over(p, kit.halo, h.alpha * (1 - e2) ** 2);
  const a = veilAlpha(u, y, L);
  const tone = kit.veilTones[Math.floor(u + CX)];
  // The body of the veil, turning to the faint lilac of its fringe as it melts away.
  if (a > 0 && tone) overMix(p, tone, kit.fringe, 1 - a, a);
  const arcs = N.arcs;
  const along = Math.abs(u) / arcs.reach;
  // The arcs only where there is room for them above the fringe (not on the shortest screens).
  if (along < 1 && L.arcY >= arcs.y * 0.8) {
    const d = Math.abs(Math.abs(y) - (L.arcY - arcs.sag * along * along * L.fit));
    const fade = 1 - rampBetween(along, 0.7, 1);
    const line = 1 - rampBetween(d, arcs.width / 2, arcs.width / 2 + arcs.soft);
    over(p, kit.arc, arcs.alpha * fade * line);
  }
  const core = N.core;
  const c = Math.hypot(u, y) / core.radius;
  if (c < 1) over(p, kit.cream, core.alpha * (1 - c) ** 1.6);
  const shade = shadeAt(kit, u, y, hit);
  if (shade > 0) over(p, kit.shade, ARMS.shade.veilAlpha * shade);
  over(p, kit.vein, core.vein.alpha * veinAt(u, y));
}

const VEIN_COS = Math.cos(N.core.vein.angle);
const VEIN_SIN = Math.sin(N.core.vein.angle);

/**
 * How much of the dark dust vein through the core lies at (`u`, `y`), 0..1: a short steep stroke that
 * fades out in the middle band of the row, where the face of the layer is.
 */
export function veinAt(u: number, y: number): number {
  const vein = N.core.vein;
  const along = (u * VEIN_COS + y * VEIN_SIN) / vein.length;
  if (Math.abs(along) >= 1) return 0;
  const across = -u * VEIN_SIN + y * VEIN_COS - vein.bend * Math.sin(Math.PI * along);
  const fade =
    (1 - rampBetween(Math.abs(along), 0.55, 1)) * rampBetween(Math.abs(y), ...vein.clear);
  return fade * (1 - rampBetween(Math.abs(across), vein.width / 2, vein.width / 2 + 1.2));
}

function paintArm(kit: BakeKit, arm: ArmName, p: Paint, u: number, y: number, hit: Hit): void {
  nearest(kit.shapes[arm], kit.layout, u, y, hit);
  if (hit.n >= kit.layout.glow) return;
  armPaint(kit.tones[arm], hit.n, hit.end, kit.layout.glow, p);
  // Dimmed at the core and cut along the dust vein, so the cream, the star and the dark vein read.
  let k = ARMS[arm].alpha * coreDim(Math.hypot(u, y) / N.core.radius) * kit.layout.light;
  k *= 1 - veinAt(u, y);
  if (arm === 'blue') k *= 1 - ARMS.shade.alpha * shadeAt(kit, u, y, hit);
  scalePaint(p, k);
}

// ---- Strokes over the pixels ------------------------------------------------------------------------

/** Sprinkle colours of the layers, white left out. */
const SPRINKLE_COLORS = PLAIN_LAYER.decor.sprinkles.colors.filter((c) => c !== 0xffffff);

/** The sprinkle strokes of `arm`, the figure centre at (`cx`, `cy`) of the canvas. */
function drawSprinkles(
  ctx: CanvasRenderingContext2D,
  arm: ArmName,
  layout: NebulaLayout,
  cx: number,
  cy: number,
): void {
  const s = N.sprinkles;
  ctx.lineCap = 'round';
  ctx.lineWidth = s.width;
  s.spots.forEach((spot, i) => {
    if (spot.arm !== arm) return;
    const slope = armSlope(arm, spot.u, layout);
    const len = Math.hypot(1, slope);
    const w = armWidth(arm, spot.u) * spot.across;
    const x = cx + spot.u - (slope / len) * w;
    const y = cy + armAxisY(arm, spot.u, layout) + w / len;
    const a = Math.atan2(slope, 1) + spot.turn;
    const dx = (Math.cos(a) * s.length) / 2;
    const dy = (Math.sin(a) * s.length) / 2;
    ctx.strokeStyle = cssColor(SPRINKLE_COLORS[i % SPRINKLE_COLORS.length] ?? 0xffd35c);
    ctx.beginPath();
    ctx.moveTo(x - dx, y - dy);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  });
}

/** A four-ray star: concave rays of radius `r`, `waist` of it wide at the middle. */
function fourRays(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  waist: number,
): void {
  const w = r * waist;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + w, y - w, x + r, y);
  ctx.quadraticCurveTo(x + w, y + w, x, y + r);
  ctx.quadraticCurveTo(x - w, y + w, x - r, y);
  ctx.quadraticCurveTo(x - w, y - w, x, y - r);
  ctx.fill();
}

function softDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
): void {
  const dot = ctx.createRadialGradient(x, y, 0, x, y, r);
  dot.addColorStop(0, color);
  dot.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = dot;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TWO_PI);
  ctx.fill();
}

/** The sparks (soft dots and small four-ray stars) and the crisp star of the core, on the pink picture. */
function drawSparks(
  ctx: CanvasRenderingContext2D,
  layout: NebulaLayout,
  cx: number,
  cy: number,
): void {
  const yScale = nebulaYScale(layout);
  for (const s of N.sparks) {
    const x = cx + s.x;
    const y = cy + s.y * yScale;
    if (s.r < 5) {
      softDot(ctx, x, y, s.r, 'rgba(255,255,255,1)');
      continue;
    }
    softDot(ctx, x, y, s.r * 0.5, 'rgba(255,255,255,0.9)');
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    fourRays(ctx, x, y, s.r, 0.12);
  }
  const star = N.core.star;
  // The warm glow round the star, then its bright middle.
  const [r, g, b] = rgb(star.glow);
  softDot(ctx, cx, cy, star.r * star.warm, `rgba(${r},${g},${b},${star.warmAlpha})`);
  softDot(ctx, cx, cy, star.r * 0.55, cssColor(star.color));
  ctx.fillStyle = cssColor(star.color);
  fourRays(ctx, cx, cy, star.r, star.waist);
  fourRays(ctx, cx, cy, star.r * 0.45, star.waist * 2);
}

// ---- The bake ---------------------------------------------------------------------------------------

/** The layout each nebula texture was baked with (all of it): it is baked again when the screen asks for another. */
const bakedLayout = new Map<string, string>();

/** Rows of the texture taken by each picture, top to bottom with a 2 px gap. */
function textureRows(rects: Record<NebulaFrame, FrameRect>): Record<NebulaFrame, number> {
  const blue = rects.veil.h + 2;
  return { veil: 0, blue, pink: blue + rects.blue.h + 2 };
}

/**
 * Bakes the nebula laid out by `layout` (`nebulaLayout` of the screen) into texture `key` (frames
 * `NEBULA_FRAMES`, cut by `rects`), as deferred steps of `bake.rowsPerStep` rows when called inside
 * `collectBakeSteps`. A texture baked for another layout is replaced (only at run load, when nothing
 * shows it).
 */
export function bakeNebulaArms(
  scene: Phaser.Scene,
  key: string,
  layout: NebulaLayout,
  rects: Record<NebulaFrame, FrameRect> = nebulaFrameRects(layout),
): void {
  const signature = JSON.stringify(layout);
  if (scene.textures.exists(key)) {
    if (bakedLayout.get(key) === signature) return;
    scene.textures.remove(key);
  }
  bakedLayout.set(key, signature);
  const rows = textureRows(rects);
  const height = rows.pink + rects.pink.h;
  const pixels = new Uint8ClampedArray(new ArrayBuffer(W * height * 4));
  const image = new ImageData(pixels, W, height);
  // In main memory: the slices go on with `putImageData`, and the texture is made without reading
  // the whole picture back from the video chip in one frame of the run.
  const { canvas, context: ctx } = createCpuCanvas(W, height);
  let kit: BakeKit | null = null;
  const p: Paint = { r: 0, g: 0, b: 0, a: 0 };
  const hit: Hit = { n: Infinity, end: 0 };
  for (const frame of ['veil', 'blue', 'pink'] as const) {
    const rect = rects[frame];
    for (let from = 0; from < rect.h; from += N.bake.rowsPerStep) {
      const to = Math.min(from + N.bake.rowsPerStep, rect.h);
      deferStep(() => {
        kit ??= bakeKit(layout);
        for (let row = from; row < to; row++) {
          const y = rect.y + row + 0.5 - CY;
          const outRow = rows[frame] + row;
          for (let col = 0; col < rect.w; col++) {
            const u = rect.x + col + 0.5 - CX;
            p.r = p.g = p.b = p.a = 0;
            if (frame === 'veil') paintVeil(kit, p, u, y, hit);
            else paintArm(kit, frame, p, u, y, hit);
            put(pixels, (outRow * W + col) * 4, p, col, outRow);
          }
        }
        // Each slice goes onto the canvas as it is done, so the last step only adds the strokes.
        ctx?.putImageData(image, 0, 0, 0, rows[frame] + from, rect.w, to - from);
      });
    }
  }
  deferStep(() => {
    if (!ctx) return;
    for (const arm of ARM_NAMES) {
      drawSprinkles(ctx, arm, layout, CX - rects[arm].x, rows[arm] + CY - rects[arm].y);
    }
    drawSparks(ctx, layout, CX - rects.pink.x, rows.pink + CY - rects.pink.y);
  });
  deferStep(() => {
    const texture = scene.textures.addCanvas(key, canvas);
    if (!texture) return;
    for (const frame of ['veil', 'blue', 'pink'] as const) {
      const r = rects[frame];
      texture.add(NEBULA_FRAMES[frame], 0, 0, rows[frame], r.w, r.h);
    }
  });
}
