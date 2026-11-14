import type { CreatureId } from '../../data/creatures';
import { LICK, type LickStyle } from '../../data/lick';
import { backOut, clamp01, MS_PER_SECOND, pickRange, smoothstep } from '../../util/math';

/** The big scene (the whole loop round the face) or the short one (one sideways stroke). */
export type LickScene = 'big' | 'short';
/** How the drop of the big scene comes to the face: it runs down beside the eye, or falls onto the cheek. */
export type LickKind = 'run' | 'fall';

export type BigStage = keyof typeof LICK.big;
export type ShortStage = keyof typeof LICK.short;
/** Where a lick is in its course. */
export type LickStage = BigStage | ShortStage | 'done';

const BEATS: Readonly<Record<LickScene, Readonly<Record<string, number>>>> = {
  big: LICK.big,
  short: LICK.short,
};
/** The beats of each scene in order (made once, read every frame). */
const STAGES: Readonly<Record<LickScene, readonly LickStage[]>> = {
  big: Object.keys(LICK.big) as LickStage[],
  short: Object.keys(LICK.short) as LickStage[],
};
const PLAIN_STYLE: LickStyle = LICK.styles.plain;
const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;

/** How a layer licks: plain layers and most creatures alike, a few creatures in their own way. */
export function lickStyleFor(creature: CreatureId | null): LickStyle {
  const own = creature ? LICK.creatureStyles[creature] : undefined;
  return own ? LICK.styles[own] : PLAIN_STYLE;
}

/** One moment of a lick: the beat, how far into it (0..1), and the time since the lick started. */
export interface LickFrame {
  stage: LickStage;
  p: number;
  /** Time since the beat started. */
  inMs: number;
  /** Time since the lick started. */
  tMs: number;
}

/** A fresh frame to fill. */
export function newLickFrame(): LickFrame {
  return { stage: 'arrive', p: 0, inMs: 0, tMs: 0 };
}

/** Length of a beat of a scene in this style. */
export function beatMs(scene: LickScene, stage: string, style: LickStyle = PLAIN_STYLE): number {
  return (BEATS[scene][stage] ?? 0) * style.tempo;
}

/** Time from the start of the lick to the start of `stage`. */
export function beatStartMs(
  scene: LickScene,
  stage: LickStage,
  style: LickStyle = PLAIN_STYLE,
): number {
  let t = 0;
  for (const s of STAGES[scene]) {
    if (s === stage) return t;
    t += beatMs(scene, s, style);
  }
  return t;
}

/** Total length of a scene. */
export function lickDurationMs(scene: LickScene, style: LickStyle = PLAIN_STYLE): number {
  return beatStartMs(scene, 'done', style);
}

/** The lick `tMs` after it started; fills and returns `out`. */
export function lickFrame(
  scene: LickScene,
  tMs: number,
  style: LickStyle = PLAIN_STYLE,
  out: LickFrame = newLickFrame(),
): LickFrame {
  out.tMs = tMs;
  let start = 0;
  for (const s of STAGES[scene]) {
    const length = beatMs(scene, s, style);
    if (tMs < start + length) {
      out.stage = s;
      out.inMs = Math.max(0, tMs - start);
      out.p = clamp01(out.inMs / length);
      return out;
    }
    start += length;
  }
  out.stage = 'done';
  out.p = 1;
  out.inMs = tMs - start;
  return out;
}

/** The loop of the tongue tip on one face: its half width, which way it goes first (1: right), and the peak length. */
export interface LoopShape {
  rx: number;
  dir: 1 | -1;
  peak: number;
}

/**
 * The loop for a face `faceScale` big on a layer `width` wide: narrower on a narrow layer, so the
 * tongue stays within about half the layer width (it lies along at most half the loop), and the
 * peak no longer than half the layer width either.
 */
export function loopShape(
  width: number,
  faceScale: number,
  dir: 1 | -1,
  style: LickStyle = PLAIN_STYLE,
): LoopShape {
  const { rx, ry, minRxShare } = LICK.loop;
  const half = width / 2 / (faceScale || 1);
  const fit = (2 * half) / Math.PI - ry;
  return {
    rx: Math.min(rx, Math.max(rx * minRxShare, fit)),
    dir,
    peak: Math.min(LICK.peak.px * style.peak, half),
  };
}

/** The point `phase` (0..1) round the loop; 0 and 1 are at the mouth. `skid` pushes the side turns out. */
export function loopPoint(
  phase: number,
  shape: LoopShape,
  out: { x: number; y: number },
  skid = 0,
): void {
  const { ry, centerY } = LICK.loop;
  const s = Math.sin(TWO_PI * phase);
  out.x = shape.dir * shape.rx * s * (1 + skid * s * s);
  out.y = centerY + ry * Math.cos(TWO_PI * phase);
}

/** Where the tip turns back: round to `loopTo`, or `sweep` of the way for a one-motion lick. */
function farthest(style: LickStyle): number {
  return Math.min(LICK.loop.loopTo, style.sweep);
}

/** Where the tip ends the loop and stretches out from. */
function endPhase(style: LickStyle): number {
  return style.sweep >= 1 ? LICK.loop.loopTo : LICK.loop.shootTo;
}

const AFTER_LOOP: readonly LickStage[] = ['stretch', 'hold', 'curl', 'snap'];

/** How far round the loop the tip is in the big scene (-1: the tongue is in). */
export function tipPhase(frame: Readonly<LickFrame>, style: LickStyle = PLAIN_STYLE): number {
  const { shootTo, shootOvershoot, loopTo, accel } = LICK.loop;
  const { stage, p } = frame;
  if (stage === 'shoot') return shootTo * backOut(p, shootOvershoot);
  if (stage === 'loop') {
    if (style.sweep >= 1) return shootTo + (loopTo - shootTo) * Math.pow(p, accel);
    return shootTo + (farthest(style) - shootTo) * Math.sin(Math.PI * p);
  }
  if (AFTER_LOOP.includes(stage)) return endPhase(style);
  return -1;
}

/** The farthest the tip has got so far (a one-motion lick comes back the way it went). */
export function reachedPhase(frame: Readonly<LickFrame>, style: LickStyle = PLAIN_STYLE): number {
  const { stage, p } = frame;
  if (stage === 'shoot') return tipPhase(frame, style);
  if (stage === 'loop') {
    if (style.sweep >= 1 || p < 0.5) return tipPhase(frame, style);
    return farthest(style);
  }
  if (AFTER_LOOP.includes(stage) || stage === 'lips' || stage === 'happy' || stage === 'done') {
    return Math.max(endPhase(style), farthest(style));
  }
  return -1;
}

/** How much the side turns are pushed out now: the tip skids more the faster it goes. */
function skidNow(frame: Readonly<LickFrame>): number {
  if (frame.stage === 'loop') return LICK.loop.skid * frame.p;
  return AFTER_LOOP.includes(frame.stage) ? LICK.loop.skid : 0;
}

const scratch = { x: 0, y: 0 };
const end = { x: 0, y: 0 };
const tip = { x: 0, y: 0 };

/** The tip of the big scene; false while the tongue is in. */
export function bigTip(
  frame: Readonly<LickFrame>,
  style: LickStyle,
  shape: LoopShape,
  out: { x: number; y: number },
): boolean {
  const phase = tipPhase(frame, style);
  if (phase < 0) return false;
  loopPoint(phase, shape, out, skidNow(frame));
  if (!AFTER_LOOP.includes(frame.stage)) return true;
  const side = Math.sign(out.x) || shape.dir;
  const px = side * shape.peak;
  const py = LICK.peak.y;
  const t = frame.stage === 'stretch' ? backOut(frame.p, LICK.peak.overshoot) : 1;
  out.x += (px - out.x) * t;
  out.y += (py - out.y) * t;
  return true;
}

/** The short scene: the drop, where the tip goes out to and where its stroke ends (face pixels). */
function shortPoints(side: 1 | -1): {
  mx: number;
  my: number;
  dx: number;
  dy: number;
  ox: number;
  oy: number;
  sx: number;
  sy: number;
} {
  const s = LICK.shortPath;
  const my = s.mouthY;
  return {
    mx: side * s.mouthX,
    my,
    dx: side * s.dropX,
    dy: s.dropY,
    ox: side * (s.dropX + s.out.dx),
    oy: s.dropY + s.out.dy,
    sx: side * (s.dropX + s.stroke.dx),
    sy: s.dropY + s.stroke.dy,
  };
}

/** The tip of the short scene; false while the tongue is in. */
export function shortTip(
  frame: Readonly<LickFrame>,
  side: 1 | -1,
  out: { x: number; y: number },
): boolean {
  const k = shortPoints(side);
  const { stage, p } = frame;
  if (stage === 'out') {
    const t = backOut(p, LICK.shortPath.outOvershoot);
    out.x = k.mx + (k.ox - k.mx) * t;
    out.y = k.my + (k.oy - k.my) * t;
    return true;
  }
  if (stage === 'stroke' || stage === 'back') {
    // One stroke up through the drop, bowing outwards.
    const t = stage === 'stroke' ? smoothstep(p) : 1;
    const cx = k.ox + side * LICK.shortPath.bow;
    const cy = (k.oy + k.sy) / 2;
    const u = 1 - t;
    out.x = u * u * k.ox + 2 * u * t * cx + t * t * k.sx;
    out.y = u * u * k.oy + 2 * u * t * cy + t * t * k.sy;
    return true;
  }
  return false;
}

const offsets: number[] = [];

/**
 * The tongue at this moment as a chain of `LICK.tongue.segments` pieces: fills `out` with the
 * points from the mouth to the tip, flat `[x0, y0, x1, y1, ...]` in face pixels, and returns the
 * width multiplier of the tongue (0: it is in). In the big scene it lies along the way the tip
 * came, then swings across the face in a bow; a wave runs along it, at the peak it trembles,
 * the tip curls and the whole tongue snaps back into the mouth. In the short scene it is a bow
 * from the corner of the mouth to the tip.
 */
export function tongueBody(
  scene: LickScene,
  frame: Readonly<LickFrame>,
  style: LickStyle,
  shape: LoopShape,
  out: number[],
): number {
  const n = LICK.tongue.segments;
  const { stage, p } = frame;
  let mx: number;
  let my: number;
  let w: number;
  let headPhase = 0;
  if (scene === 'big') {
    if (!bigTip(frame, style, shape, tip)) return 0;
    headPhase = tipPhase(frame, style);
    loopPoint(headPhase, shape, end, skidNow(frame));
    loopPoint(0, shape, scratch);
    mx = scratch.x;
    my = scratch.y;
    const { wrapUntil, sweepOver } = LICK.loop;
    w = smoothstep((headPhase - wrapUntil) / sweepOver);
    if (AFTER_LOOP.includes(stage)) w = stage === 'stretch' ? w + (1 - w) * p : 1;
  } else {
    if (!shortTip(frame, shape.dir, tip)) return 0;
    const k = shortPoints(shape.dir);
    mx = k.mx;
    my = k.my;
    w = 1;
  }
  // The bow bulges out from the middle of the face; the short one bends at a low knee under the eye.
  const midX = (mx + tip.x) / 2;
  const midY = (my + tip.y) / 2;
  const bulge = LICK.loop.bulge;
  let cx = midX * (1 + bulge);
  let cy = midY + (midY - LICK.loop.centerY) * bulge;
  if (scene === 'short') {
    const k = shortPoints(shape.dir);
    const { knee } = LICK.shortPath;
    const reach = clamp01(Math.hypot(tip.x - mx, tip.y - my) / Math.hypot(k.ox - mx, k.oy - my));
    cx = midX + (shape.dir * knee.x - midX) * reach;
    cy = midY + (knee.y - midY) * reach;
  }
  // The short tongue goes back in along its own bow, so it never swings over the eye.
  const keep = stage === 'back' ? 1 - p * p : 1;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * keep;
    let wx = 0;
    let wy = 0;
    if (w < 1) {
      // Along the way the tip came, shifted at the end onto the tip.
      loopPoint(headPhase * t, shape, scratch, skidNow(frame));
      wx = scratch.x + (tip.x - end.x) * t;
      wy = scratch.y + (tip.y - end.y) * t;
    }
    const u = 1 - t;
    const qx = u * u * mx + 2 * u * t * cx + t * t * tip.x;
    const qy = u * u * my + 2 * u * t * cy + t * t * tip.y;
    out[i * 2] = wx + (qx - wx) * w;
    out[i * 2 + 1] = wy + (qy - wy) * w;
  }
  addWave(scene, frame, n, out);
  curlAndSnap(scene, frame, shape.dir, mx, my, n, out);
  const smear = LICK.tongue.smear;
  if (stage === 'shoot' || stage === 'out')
    return smear.width + (1 - smear.width) * clamp01(p / smear.share);
  return 1;
}

/** The wave running from root to tip, and the trembling at the peak, across the tongue. */
function addWave(scene: LickScene, frame: Readonly<LickFrame>, n: number, out: number[]): void {
  if (frame.stage === 'snap' || frame.stage === 'back') return;
  const { wave, tremble } = LICK.tongue;
  const sec = frame.tMs / MS_PER_SECOND;
  const shake =
    scene === 'big' && frame.stage === 'hold'
      ? tremble.amp * Math.sin(TWO_PI * tremble.hz * sec)
      : 0;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    offsets[i] = t * (wave.amp * Math.sin(TWO_PI * (t / wave.length - wave.hz * sec)) + shake);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.max(0, i - 1);
    const b = Math.min(n, i + 1);
    const tx = out[b * 2]! - out[a * 2]!;
    const ty = out[b * 2 + 1]! - out[a * 2 + 1]!;
    const length = Math.hypot(tx, ty) || 1;
    // Offsets go along the normal of the body (computed before any point moved).
    offsets[n + 1 + i * 2] = (-ty / length) * offsets[i]!;
    offsets[n + 2 + i * 2] = (tx / length) * offsets[i]!;
  }
  for (let i = 0; i <= n; i++) {
    out[i * 2] = out[i * 2]! + offsets[n + 1 + i * 2]!;
    out[i * 2 + 1] = out[i * 2 + 1]! + offsets[n + 2 + i * 2]!;
  }
}

/** The tip curls (the big scene) and the tongue snaps back into the mouth, keeping its shape. */
function curlAndSnap(
  scene: LickScene,
  frame: Readonly<LickFrame>,
  dir: 1 | -1,
  mx: number,
  my: number,
  n: number,
  out: number[],
): void {
  const { stage, p } = frame;
  const curl = stage === 'curl' ? backOut(p) : stage === 'snap' ? 1 : 0;
  const shrink = stage === 'snap' ? 1 - p * p : 1;
  if ((scene !== 'big' || curl === 0) && shrink === 1) return;
  const { curlDeg, curlShare } = LICK.tongue;
  const from = Math.floor(n * (1 - curlShare));
  const steps = n - from;
  let turn = 0;
  let px = mx;
  let py = my;
  let prevX = out[0]!;
  let prevY = out[1]!;
  for (let i = 1; i <= n; i++) {
    const dx = out[i * 2]! - prevX;
    const dy = out[i * 2 + 1]! - prevY;
    prevX = out[i * 2]!;
    prevY = out[i * 2 + 1]!;
    if (scene === 'big' && i > from) {
      // The steps grow linearly and add up to the whole curl.
      const k = i - from;
      turn += ((curlDeg * DEG * curl * 2 * k) / (steps * (steps + 1))) * dir;
    }
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    px += (dx * c - dy * s) * shrink;
    py += (dx * s + dy * c) * shrink;
    out[i * 2] = px;
    out[i * 2 + 1] = py;
  }
}

/**
 * Share of its length a growing drip shows `sinceMs` after the tongue touched it: it shrinks
 * quickly with a little spring, then slowly regrows to the whole length.
 */
export function lickedDripShare(sinceMs: number): number {
  const { shortenTo, shrinkMs, overshoot, regrowMs } = LICK.drip;
  if (!(sinceMs >= 0) || sinceMs >= shrinkMs + regrowMs) return 1;
  if (sinceMs < shrinkMs) {
    return Math.max(0, 1 - (1 - shortenTo) * backOut(sinceMs / shrinkMs, overshoot));
  }
  return shortenTo + (1 - shortenTo) * smoothstep((sinceMs - shrinkMs) / regrowMs);
}

/** Distance from (x, y) to the piece `i` (from point `i - 1` to point `i`) of a chain of points (flat `[x0, y0, ...]`). */
export function pieceDistance(points: readonly number[], i: number, x: number, y: number): number {
  const ax = points[i * 2 - 2]!;
  const ay = points[i * 2 - 1]!;
  const vx = points[i * 2]! - ax;
  const vy = points[i * 2 + 1]! - ay;
  const lengthSq = vx * vx + vy * vy;
  const t = lengthSq === 0 ? 0 : clamp01(((x - ax) * vx + (y - ay) * vy) / lengthSq);
  return Math.hypot(x - ax - vx * t, y - ay - vy * t);
}

/** Distance from (x, y) to a chain of `count` points (flat `[x0, y0, ...]`). */
export function chainDistance(
  points: readonly number[],
  count: number,
  x: number,
  y: number,
): number {
  let best = Infinity;
  for (let i = 1; i < count; i++) best = Math.min(best, pieceDistance(points, i, x, y));
  return best;
}

/** Length of a chain of points (flat `[x0, y0, ...]`, `count` points). */
export function chainLength(points: readonly number[], count: number): number {
  let length = 0;
  for (let i = 1; i < count; i++) {
    length += Math.hypot(
      points[i * 2]! - points[i * 2 - 2]!,
      points[i * 2 + 1]! - points[i * 2 - 1]!,
    );
  }
  return length;
}

/** Where the drop ends up: on the loop (the big scene) or on the cheek (the short one). */
export function dropPoint(
  scene: LickScene,
  kind: LickKind,
  shape: LoopShape,
  out: { x: number; y: number },
): void {
  if (scene === 'short') {
    const k = shortPoints(shape.dir);
    out.x = k.dx;
    out.y = k.dy;
    return;
  }
  loopPoint(kind === 'run' ? LICK.drop.runAt : LICK.drop.fallAt, shape, out);
}

/** What the glaze of the lick shows, in face pixels. */
export interface LickGlaze {
  /** A drip running down from the glaze edge, a drop, or nothing. */
  kind: 'none' | 'drip' | 'drop';
  x: number;
  /** The lower end of the drip, or the centre of the drop. */
  y: number;
  /** Vertical squash of the drop (1: round), and its scale while it is eaten. */
  squash: number;
  scale: number;
}

/** The drop squashes as it lands and springs back. */
function landSquash(sinceMs: number): number {
  const { landSquash: from, squashMs } = LICK.drop;
  return from + (1 - from) * backOut(sinceMs / squashMs);
}

/**
 * The drop at this moment: `rootY` is where it leaves the glaze edge. It runs down beside the eye
 * or falls onto the cheek and squashes; once the tongue gets to it, it is gone. Fills `out`.
 */
export function lickGlaze(
  scene: LickScene,
  kind: LickKind,
  style: LickStyle,
  shape: LoopShape,
  frame: Readonly<LickFrame>,
  rootY: number,
  out: LickGlaze,
): LickGlaze {
  out.squash = 1;
  out.scale = 1;
  const running = scene === 'big' && kind === 'run';
  out.kind = running ? 'drip' : 'drop';
  dropPoint(scene, kind, shape, scratch);
  out.x = scratch.x;
  const endY = scratch.y;
  const { stage, p } = frame;
  if (stage === 'arrive') {
    out.y = rootY + (endY - rootY) * (running ? smoothstep(p) : p * p);
    return out;
  }
  out.y = endY;
  if (!running) out.squash = landSquash(frame.tMs - beatMs(scene, 'arrive', style));
  if (scene === 'short') return shortEaten(frame, shape.dir, out);
  const at = kind === 'run' ? LICK.drop.runAt : LICK.drop.fallAt;
  const reached = reachedPhase(frame, style);
  if (reached < at) return out;
  // The tip took it: it goes within about `eatMs` (as a stretch of the loop at the tip's mean speed).
  const span =
    (LICK.drop.eatMs / beatMs('big', 'loop', style)) * (farthest(style) - LICK.loop.shootTo);
  out.scale = stage === 'shoot' || stage === 'loop' ? 1 - clamp01((reached - at) / span) : 0;
  if (out.scale <= 0) out.kind = 'none';
  return out;
}

/** In the short scene the stroke takes the drop along on the tip, and it is gone. */
function shortEaten(frame: Readonly<LickFrame>, side: 1 | -1, out: LickGlaze): LickGlaze {
  const { stage, p } = frame;
  if (stage === 'sly' || stage === 'out') return out;
  const takeAt = LICK.shortPath.takeAt;
  if (stage !== 'stroke' || p >= 1) {
    out.kind = 'none';
    return out;
  }
  if (p < takeAt) return out;
  shortTip(frame, side, scratch);
  const t = (p - takeAt) / (1 - takeAt);
  out.x = scratch.x;
  out.y = scratch.y;
  out.scale = 1 - t;
  if (out.scale <= 0) out.kind = 'none';
  return out;
}

/** How an eye looks in a lick: open (on the drop), squinted to a line, blissfully shut as an arc, or as the expression says. */
export type EyeLook = 'open' | 'shut' | 'bliss' | 'expr';

/** How the face looks during a lick, besides the tongue. */
export interface LickFace {
  /** Brows up (0: as the expression says); springs past 1. `browSide` 0 raises both, ±1 only that one. */
  brow: number;
  browSide: -1 | 0 | 1;
  /** The mouth: as the expression says, a small "oh", pursed, gaping (by `open`), or open. */
  mouth: 'expr' | 'oh' | 'purse' | 'gape' | 'wide';
  open: number;
  /** The eyes and brows go up to make room for the gaping mouth (0..1 of `LICK.face.gape.eyesUpPx`). */
  eyesUp: number;
  eyeL: EyeLook;
  eyeR: EyeLook;
  /** The pupils look at the drop. */
  look: boolean;
  /** Warmer, bigger cheeks (0: as always); springs past 1. */
  blush: number;
  /** The cheeks puff for an instant when the tongue snaps in (0..1). */
  puff: number;
  /** Scale of the whole face: the wind-up squeeze and the spring after the snap. */
  scaleX: number;
  scaleY: number;
  /** The face dents and stretches after the tongue. */
  dent: boolean;
}

/** A fresh face pose to fill. */
export function newLickFace(): LickFace {
  return {
    brow: 0,
    browSide: 0,
    mouth: 'expr',
    open: 0,
    eyesUp: 0,
    eyeL: 'expr',
    eyeR: 'expr',
    look: false,
    blush: 0,
    puff: 0,
    scaleX: 1,
    scaleY: 1,
    dent: false,
  };
}

/** The face with nothing of a lick on it; copied into a pose to start it afresh. */
const CALM_FACE: Readonly<LickFace> = newLickFace();

function puffAt(sinceSnapMs: number): number {
  const { ms } = LICK.face.puff;
  return sinceSnapMs >= 0 && sinceSnapMs < ms ? Math.sin((Math.PI * sinceSnapMs) / ms) : 0;
}

/** The face springs after the snap: a swing of the scale that dies out. */
export function springAt(sinceSnapMs: number): number {
  const { amp, periodMs, decayMs, ms } = LICK.face.spring;
  if (sinceSnapMs < 0 || sinceSnapMs >= ms) return 0;
  return amp * Math.sin((TWO_PI * sinceSnapMs) / periodMs) * Math.exp(-sinceSnapMs / decayMs);
}

/** The face at this moment of a lick (`side`: the side of the drop in the short scene); fills `out`. */
export function lickFace(
  scene: LickScene,
  frame: Readonly<LickFrame>,
  style: LickStyle,
  side: 1 | -1,
  out: LickFace,
): LickFace {
  Object.assign(out, CALM_FACE);
  if (scene === 'short') return shortFace(frame, side, out);
  const { stage, p } = frame;
  const sinceSnap = frame.tMs - beatStartMs('big', 'snap', style);
  const eyes = (look: EyeLook): void => {
    out.eyeL = look;
    out.eyeR = look;
  };
  // While the tongue is out the eyes are open (the face shuts the one it lies over).
  const gape = (open: number): void => {
    out.mouth = 'gape';
    out.open = open;
    out.eyesUp = Math.min(1, Math.max(0, open));
  };
  switch (stage) {
    case 'arrive':
      out.look = true;
      return out;
    case 'notice':
      out.look = true;
      out.brow = backOut(p);
      out.mouth = 'oh';
      out.open = backOut(p);
      return out;
    case 'windup': {
      const { scaleX, scaleY, purse } = LICK.face.windup;
      const q = backOut(p);
      out.look = true;
      out.brow = 1;
      out.mouth = 'purse';
      out.open = purse;
      out.scaleX = 1 + (scaleX - 1) * q;
      out.scaleY = 1 + (scaleY - 1) * q;
      return out;
    }
    case 'shoot': {
      const { scaleX, scaleY } = LICK.face.windup;
      eyes('open');
      out.brow = 1;
      gape(backOut(p, LICK.face.gape.overshoot));
      out.scaleX = 1 + (scaleX - 1) * (1 - p);
      out.scaleY = 1 + (scaleY - 1) * (1 - p);
      out.dent = true;
      return out;
    }
    case 'loop':
    case 'stretch':
    case 'hold':
    case 'curl':
      eyes('open');
      out.brow = 1;
      gape(1);
      out.dent = true;
      return out;
    case 'snap':
      eyes('bliss');
      out.brow = 1 - p;
      gape(1 - p);
      out.puff = puffAt(sinceSnap);
      return out;
    case 'lips':
      eyes('bliss');
      out.mouth = style.lips ? 'wide' : 'expr';
      out.open = LICK.face.wideScale;
      out.puff = puffAt(sinceSnap);
      out.scaleX = out.scaleY = 1 + springAt(sinceSnap);
      return out;
    case 'happy':
      out.blush = backOut(Math.min(1, p * 2));
      out.scaleX = out.scaleY = 1 + springAt(sinceSnap);
      return out;
    default:
      return out;
  }
}

/** The short scene: one eye squinted on the drop's side, the other on the drop, the far brow up. */
function shortFace(frame: Readonly<LickFrame>, side: 1 | -1, out: LickFace): LickFace {
  const { stage, p } = frame;
  if (stage === 'arrive') {
    out.look = true;
    return out;
  }
  if (stage === 'done') return out;
  out.look = true;
  if (side > 0) out.eyeR = 'shut';
  else out.eyeL = 'shut';
  out.brow = stage === 'sly' ? backOut(p) : 1;
  out.browSide = side > 0 ? -1 : 1;
  if (stage === 'out' || stage === 'stroke' || stage === 'back') {
    out.mouth = 'wide';
    out.open = LICK.face.wideScale * (stage === 'back' ? 1 - p : 1);
  }
  return out;
}

/** The short tongue that licks the lips: it starts at (x, y), points `angleDeg` clockwise from up. */
export interface LipsTongue {
  shown: boolean;
  x: number;
  y: number;
  angleDeg: number;
  length: number;
  widthScale: number;
}

/** A fresh lips tongue to fill. */
export function newLipsTongue(): LipsTongue {
  return { shown: false, x: 0, y: 0, angleDeg: 0, length: 0, widthScale: 1 };
}

/** The tongue licking the lips `p` (0..1) of the way, from the `side` corner to the other. */
export function lipsTongue(p: number, side: 1 | -1, out: LipsTongue): LipsTongue {
  const { fromX, toX, y, angleDeg, length, widthScale } = LICK.lips;
  const t = smoothstep(p);
  out.shown = p > 0 && p < 1;
  out.x = (fromX + (toX - fromX) * t) * side;
  out.y = y;
  out.angleDeg = (-angleDeg + 2 * angleDeg * t) * side;
  out.length = length * Math.sqrt(Math.max(0, Math.sin(Math.PI * clamp01(p))));
  out.widthScale = widthScale;
  return out;
}

/** Counts down to the next lick: at most one for the whole tower per interval; the first one is big. */
export class LickScheduler {
  private waitMs: number;
  private count = 0;

  constructor(private readonly random: () => number) {
    this.waitMs = pickRange(LICK.firstDelayMs, random);
  }

  tick(dtMs: number): void {
    if (this.waitMs > 0) this.waitMs -= dtMs;
  }

  get ready(): boolean {
    return this.waitMs <= 0;
  }

  /** Which scene the next lick plays: the first of a run is big, later ones mostly short. */
  nextScene(): LickScene {
    if (this.count === 0) return 'big';
    return this.random() < LICK.bigChance ? 'big' : 'short';
  }

  /** A lick started: the next one is a whole interval away. */
  started(): void {
    this.count++;
    this.waitMs = pickRange(LICK.intervalMs, this.random);
  }

  /** There was nothing to lick: look again soon. */
  retry(): void {
    this.waitMs = LICK.retryMs;
  }
}

/** What decides whether a layer may lick now. */
export interface LickCheck {
  /** The face is shown, single, big enough and not busy. */
  faceFree: boolean;
  /** 0-based index and the index of the top layer. */
  index: number;
  topIndex: number;
  /** A layer is in the air or about to spawn. */
  aiming: boolean;
  /** Screen position of the layer centre and the visible band (world y). */
  y: number;
  bandTop: number;
  bandBottom: number;
}

/**
 * A layer is in the air or about to spawn. Read from the sim state, not from where the faces
 * look: a cloud or the spawn pause hides the layer from the faces but not from the player.
 */
export function isAiming(phase: string, hasFlying: boolean): boolean {
  return hasFlying || phase === 'flying' || phase === 'falling' || phase === 'pause';
}

/** A layer licks only when it is fully on screen; the top one keeps still while a layer is in the air or about to spawn. */
export function lickAllowed(c: LickCheck): boolean {
  if (!c.faceFree) return false;
  const margin = LICK.screenMarginPx;
  if (c.y < c.bandTop + margin || c.y > c.bandBottom - margin) return false;
  if (c.index === c.topIndex && c.aiming) return false;
  return true;
}
