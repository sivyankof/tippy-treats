import type * as Phaser from 'phaser';
import { MOUNTAIN_LOOK } from '../../../data/backdrop-mountains';
import type { WeatherId } from '../../../data/weather';
import { WEATHER_LOOK, WEATHER_TEX as TEX } from '../../../data/weather-look';
import type { ZoneId } from '../../../data/zones';
import { cssColor, mixColor, shade } from '../../../util/color';
import { TWO_PI } from '../../../util/math';
import { drawGlossMark, fillPolygon, outlineColor, type Pt } from '../../fx/plain-style';
import { bakeTexture } from '../../ui/bake-texture';
import { sparkle } from './art-kit';
import { bankPuffs, type Puff } from './weather-motion';

type Graphics = Phaser.GameObjects.Graphics;

/** Snow (picture px): a small and a middle disc, then two six-ray flakes (one with side branches, one plain). */
const FLAKE_SIZES = [28, 36, 44, 44] as const;
const FLAKE_OUTLINE = 0x7e92b8;
const FLAKE_DISC_RIM = 5;
const FLAKE_RAYS = {
  count: 6,
  outlinePx: 10.5,
  bodyPx: 4.6,
  plainOutlinePx: 12.5,
  plainBodyPx: 6.6,
  branchAt: 0.55,
  branchLen: 0.3,
  branchTilt: 0.95,
};
const DROP_W = 22;
const DROP_H = 96;
const DROP_COLOR = 0xe8f2ff;
const DROP_RIM = 0x7f9ccc;
const DROP_HALF = { top: 2.4, bottom: 7.5, rim: 2.6 };
const DROP_TAIL_ALPHA = 0.3;
const DITHER_AMP = 3;
const LEAF_W = 56;
const LEAF_H = 36;
const LEAF_COLORS = [0xe8832e, 0xc9402f, 0xeab72a] as const;
const LEAF_STEPS = 18;
/** Leaf outline: half-width ~ t^a (1-t)^b, round at the stem end and pointed at the tip. */
const LEAF_SHAPE = { a: 0.55, b: 0.9 };
const STAR_SIZES = [22, 32] as const;
const STAR_COLOR = 0xfff4c8;
const SPLASH_W = 56;
const SPLASH_H = 30;
const SPLASH_COLOR = 0xeaf4ff;
const MOON_COLOR = 0xfff1b8;
const MOON_OUTLINE = 0xc9a45a;
const MOON_BITE = { dx: 0.5, dy: -0.22, grow: 0.86 };
const MOON_GLOSS = { x: -0.5, y: -0.18, length: 0.34, thick: 0.1, tilt: -1.0, dot: 0.06 };
const CAP_STEP = 5;
const CAP_TAPER = 0.55;
const CAP_RADIUS = 17;
const CAP_SWELL = 0.14;
const CAP_WAVES = 4.3;
const CAP_OUTLINE = 2.5;
const CAP_DRIPS = [0.22, 0.52, 0.8] as const;
const CAP_DRIP = { radius: 5.5, reach: 9 };
const BOLT_CORE = 0xfffbe6;
const BOLT_MID = 0xffd45e;
const BOLT_RIM = 0xb97a2a;

/** Key of the cloud bank picture of a weather (the same in both zones). */
export function bankKey(weather: WeatherId): string {
  return weather === 'storm' ? TEX.bankStorm : TEX.bankRain;
}

/** Key of the lit twin of the bank for a bolt on `side` (0 left, 1 right). */
export function bankFlashKey(side: number): string {
  return TEX.bankFlash[side] ?? '';
}

/** Adds a little noise to the alpha of a finished picture so a smooth fall-off shows no steps. */
function ditherAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const image = ctx.getImageData(0, 0, width, height);
  const px = image.data;
  let seed = 12345;
  for (let i = 3; i < px.length; i += 4) {
    const a = px[i] ?? 0;
    if (a === 0 || a === 255) continue;
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    px[i] = Math.min(255, Math.max(1, a + ((seed >>> 24) / 255 - 0.5) * DITHER_AMP));
  }
  ctx.putImageData(image, 0, 0);
}

const NO_DRAW = (): void => undefined;

/** A six-ray flake: each ray a stroke (the first kind with two short side branches), a cold outline under a white body. */
function drawFlakeRays(g: Graphics, size: number, branched: boolean): void {
  const c = size / 2;
  const f = FLAKE_RAYS;
  const r = c - f.outlinePx / 2;
  const widths = branched ? [f.outlinePx, f.bodyPx] : [f.plainOutlinePx, f.plainBodyPx];
  for (const [width, color] of [
    [widths[0] ?? 0, FLAKE_OUTLINE],
    [widths[1] ?? 0, 0xffffff],
  ] as const) {
    g.lineStyle(width, color, 1);
    for (let k = 0; k < f.count; k++) {
      const a = (k / f.count) * TWO_PI - Math.PI / 2;
      const tip = { x: c + Math.cos(a) * r, y: c + Math.sin(a) * r };
      g.lineBetween(c, c, tip.x, tip.y);
      if (!branched) continue;
      const at = { x: c + Math.cos(a) * r * f.branchAt, y: c + Math.sin(a) * r * f.branchAt };
      for (const side of [-1, 1]) {
        const b = a + side * f.branchTilt;
        g.lineBetween(
          at.x,
          at.y,
          at.x + Math.cos(b) * r * f.branchLen,
          at.y + Math.sin(b) * r * f.branchLen,
        );
      }
    }
    g.fillStyle(color, 1);
    g.fillCircle(c, c, width * 0.8);
  }
}

function bakeFlakes(scene: Phaser.Scene): void {
  FLAKE_SIZES.forEach((size, i) => {
    const key = TEX.flake[i] ?? '';
    const c = size / 2;
    if (i >= 2) {
      bakeTexture(scene, key, size, size, (g) => drawFlakeRays(g, size, i === 2));
      return;
    }
    bakeTexture(scene, key, size, size, (g) => {
      g.fillStyle(FLAKE_OUTLINE, 1);
      g.fillCircle(c, c, c);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(c, c, c - FLAKE_DISC_RIM);
    });
  });
}

/** A long light streak with a faint blue rim, thin and faint at the top and thicker and brighter towards the head. */
function bakeDrop(scene: Phaser.Scene): void {
  const cx = DROP_W / 2;
  const head = DROP_HALF.bottom + 0.6;
  const half = (y: number): number =>
    DROP_HALF.top + (DROP_HALF.bottom - DROP_HALF.top) * (y / DROP_H) ** 1.5;
  const outline = (grow: number): Pt[] => {
    const left: Pt[] = [];
    const right: Pt[] = [];
    for (let y = 0; y <= DROP_H - head; y += 4) {
      left.push({ x: cx - half(y) - grow, y });
      right.push({ x: cx + half(y) + grow, y });
    }
    return [...left, ...right.reverse()];
  };
  bakeTexture(
    scene,
    TEX.drop,
    DROP_W,
    DROP_H,
    (g) => {
      g.fillStyle(DROP_RIM, 1);
      fillPolygon(g, outline(DROP_HALF.rim));
      g.fillCircle(cx, DROP_H - head, head + DROP_HALF.rim);
      g.fillStyle(DROP_COLOR, 1);
      fillPolygon(g, outline(0));
      g.fillCircle(cx, DROP_H - head, head);
    },
    (ctx) => {
      ctx.globalCompositeOperation = 'destination-in';
      const fade = ctx.createLinearGradient(0, 0, 0, DROP_H);
      fade.addColorStop(0, `rgba(0,0,0,${DROP_TAIL_ALPHA})`);
      fade.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, DROP_W, DROP_H);
      ctx.globalCompositeOperation = 'source-over';
      ditherAlpha(ctx, DROP_W, DROP_H);
    },
  );
}

function strokePolyline(g: Graphics, points: readonly Pt[], close: boolean): void {
  const [first, ...rest] = points;
  if (!first) return;
  g.beginPath();
  g.moveTo(first.x, first.y);
  for (const p of rest) g.lineTo(p.x, p.y);
  if (close) g.closePath();
  g.strokePath();
}

/** The outline of a leaf from stem end to tip and back along the other side. */
function leafOutline(): Pt[] {
  const { a, b } = LEAF_SHAPE;
  const peakT = a / (a + b);
  const norm = peakT ** a * (1 - peakT) ** b;
  const half = (t: number): number => ((t ** a * (1 - t) ** b) / norm) * (LEAF_H / 2 - 3);
  const x0 = 7;
  const x1 = LEAF_W - 2;
  const upper: Pt[] = [];
  const lower: Pt[] = [];
  for (let i = 0; i <= LEAF_STEPS; i++) {
    const t = i / LEAF_STEPS;
    const x = x0 + (x1 - x0) * t;
    upper.push({ x, y: LEAF_H / 2 - half(t) });
    lower.push({ x, y: LEAF_H / 2 + half(t) });
  }
  return [...upper, ...lower.reverse()];
}

function bakeLeaves(scene: Phaser.Scene): void {
  LEAF_COLORS.forEach((color, i) => {
    bakeTexture(scene, TEX.leaf[i] ?? '', LEAF_W, LEAF_H, (g) => {
      const outline = leafOutline();
      const edge = outlineColor(color);
      const cy = LEAF_H / 2;
      g.fillStyle(color, 1);
      fillPolygon(g, outline);
      g.lineStyle(2.6, edge, 1);
      strokePolyline(g, outline, true);
      // The stem, the vein and a short gloss stroke with its dot.
      g.lineStyle(3, edge, 1);
      g.lineBetween(1, cy + 2, 12, cy);
      g.lineStyle(2, shade(color, -0.22), 1);
      g.lineBetween(11, cy, LEAF_W - 12, cy - 1);
      g.lineBetween(24, cy - 1, 34, cy - 8);
      g.lineBetween(24, cy - 1, 34, cy + 6);
      drawGlossMark(g, {
        x: 26,
        y: cy - 7,
        length: 10,
        thick: 3,
        tilt: -0.2,
        dotGap: 3,
        dotRadius: 1.6,
        color: 0xffffff,
        alpha: 0.75,
      });
    });
  });
}

function bakeSplash(scene: Phaser.Scene): void {
  bakeTexture(scene, TEX.splash, SPLASH_W, SPLASH_H, (g) => {
    g.fillStyle(SPLASH_COLOR, 0.75);
    g.fillEllipse(SPLASH_W / 2, SPLASH_H - 5, 34, 8);
    g.fillStyle(0xffffff, 1);
    for (const [dx, dy, r] of [
      [-18, -3, 3.4],
      [-9, -10, 3.8],
      [0, -14, 4.2],
      [9, -10, 3.8],
      [18, -3, 3.4],
    ] as const) {
      g.fillCircle(SPLASH_W / 2 + dx, SPLASH_H - 8 + dy, r);
    }
  });
}

/** Flat four-ray stars: no halo (the twinkle is the scale and alpha of the picture). */
function bakeStars(scene: Phaser.Scene): void {
  STAR_SIZES.forEach((size, i) => {
    bakeTexture(scene, TEX.star[i] ?? '', size, size, (g) => {
      sparkle(g, size / 2, size / 2, size / 2 - 1, STAR_COLOR);
    });
  });
}

/** The crescent: a warm outline all round (also along the bite), a flat body and a short gloss stroke. */
function bakeMoon(scene: Phaser.Scene): void {
  const r = WEATHER_LOOK.night.moon.radius;
  const size = Math.ceil(2 * r + 8);
  const c = size / 2;
  const edge = MOON_OUTLINE;
  const outlineW = 3;
  const bite = { x: c + MOON_BITE.dx * r, y: c + MOON_BITE.dy * r, r: r * MOON_BITE.grow };
  bakeTexture(
    scene,
    TEX.moon,
    size,
    size,
    (g) => {
      g.fillStyle(edge, 1);
      g.fillCircle(c, c, r);
      g.fillStyle(MOON_COLOR, 1);
      g.fillCircle(c, c, r - outlineW);
      drawGlossMark(g, {
        x: c + MOON_GLOSS.x * r,
        y: c + MOON_GLOSS.y * r,
        length: MOON_GLOSS.length * r,
        thick: MOON_GLOSS.thick * r,
        tilt: MOON_GLOSS.tilt,
        dotGap: r * 0.06,
        dotRadius: r * MOON_GLOSS.dot,
        color: 0xffffff,
        alpha: 0.8,
      });
    },
    (ctx) => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(bite.x, bite.y, bite.r, 0, TWO_PI);
      ctx.fill();
      // The outline along the bite, only where the moon is.
      ctx.globalCompositeOperation = 'source-atop';
      ctx.strokeStyle = cssColor(edge);
      ctx.lineWidth = outlineW * 2;
      ctx.beginPath();
      ctx.arc(bite.x, bite.y, bite.r, 0, TWO_PI);
      ctx.stroke();
    },
  );
}

/** The colour of a cloud bank (data, the same in both zones). */
export function bankColor(weather: WeatherId): number {
  return weather === 'storm' ? WEATHER_LOOK.bank.colorStorm : WEATHER_LOOK.bank.colorRain;
}

/** Fills the union of the circles of some puffs, each grown by `grow` and moved down by `drop`, in `color`. */
function fillPuffs(
  ctx: CanvasRenderingContext2D,
  puffs: readonly Puff[],
  color: number,
  grow: number,
  drop: number,
): void {
  ctx.fillStyle = cssColor(color);
  ctx.beginPath();
  for (const p of puffs) {
    ctx.moveTo(p.x + p.r + grow, p.y + drop);
    ctx.arc(p.x, p.y + drop, p.r + grow, 0, TWO_PI);
  }
  ctx.fill();
}

function newCanvas(width: number, height: number): CanvasRenderingContext2D {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d canvas');
  return ctx;
}

/** One mass of puffs with its three tones (no outline: the outline runs round the whole bank), drawn on a canvas of its own. */
function drawMass(
  mass: readonly Puff[],
  tones: { light: number; base: number; belly: number },
): HTMLCanvasElement {
  const b = WEATHER_LOOK.bank;
  const row = newCanvas(b.width, b.height);
  // Pale all over, the base tone lowered by the crescent's thickness (clipped to the mass).
  fillPuffs(row, mass, tones.light, 0, 0);
  row.globalCompositeOperation = 'source-atop';
  fillPuffs(row, mass, tones.base, 0, b.topLightPx);
  // The belly: the mass minus itself lifted by the belly's thickness.
  const belly = newCanvas(b.width, b.height);
  fillPuffs(belly, mass, tones.belly, 0, 0);
  belly.globalCompositeOperation = 'destination-out';
  fillPuffs(belly, mass, 0x000000, 0, -b.bellyPx);
  row.drawImage(belly.canvas, 0, 0);
  return row.canvas;
}

/** A thin seam in the belly tone along the upper arc of a puff. */
function strokeSeam(ctx: CanvasRenderingContext2D, p: Puff, color: number): void {
  ctx.strokeStyle = cssColor(color);
  ctx.lineWidth = WEATHER_LOOK.bank.seamPx;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
}

/**
 * The cloud bank: three rows of puffs, each row one mass (no lines between its puffs) with three tones: a
 * pale crescent along its top, the base, a darker belly along its lower edge. The soft outline runs round
 * the whole bank only, like the cloud of the Clouds zone; a few front puffs get a thin seam in the belly tone.
 */
function bakeBank(scene: Phaser.Scene, key: string, weather: WeatherId): void {
  const b = WEATHER_LOOK.bank;
  const storm = weather === 'storm';
  const color = bankColor(weather);
  const lightTo = storm ? b.lightStorm : b.lightRain;
  const puffs = bankPuffs(storm);
  bakeTexture(scene, key, b.width, b.height, NO_DRAW, (ctx) => {
    ctx.fillStyle = cssColor(shade(color, b.rowShade[0]));
    ctx.fillRect(b.stripFrom, 0, b.stripTo - b.stripFrom, b.topStripPx);
    for (const row of [0, 1, 2] as const) {
      const base = shade(color, b.rowShade[row] ?? 0);
      ctx.drawImage(
        drawMass(
          puffs.filter((p) => p.row === row),
          {
            light: mixColor(base, lightTo, b.lightMix),
            base,
            belly: shade(base, b.bellyShade),
          },
        ),
        0,
        0,
      );
    }
    const seam = shade(shade(color, b.rowShade[2] ?? 0), b.bellyShade);
    for (const p of puffs) if (p.seam) strokeSeam(ctx, p, seam);
    ctx.globalCompositeOperation = 'destination-over';
    fillPuffs(ctx, puffs, outlineColor(color), b.outlinePx, 0);
  });
}

/**
 * The flash of a storm for a bolt on one side: ONE soft warm patch centred on where the bolt stands, strongest
 * in the middle and fading to nothing at its radius (a smooth fall-off with a little noise, so no rings or steps).
 * It lies only on the clouds (nothing outside the bank glows) and is a little stronger towards the edges of the
 * puffs, so the light follows them. The picture is drawn additively over the bank.
 */
function bakeBankFlash(scene: Phaser.Scene, key: string, side: number): void {
  const b = WEATHER_LOOK.bank;
  const spot = b.flashSpots[side] ?? { x: b.width / 2, y: b.height / 2 };
  const puffs = bankPuffs(true);
  const colour = b.flashColor;
  const rgb = [(colour >> 16) & 255, (colour >> 8) & 255, colour & 255];
  bakeTexture(scene, key, b.width, b.height, NO_DRAW, (ctx) => {
    const image = ctx.createImageData(b.width, b.height);
    const px = image.data;
    let seed = 777 + side;
    for (let y = 0; y < b.height; y++) {
      for (let x = 0; x < b.width; x++) {
        const d = Math.hypot(x + 0.5 - spot.x, y + 0.5 - spot.y) / b.flashRadiusPx;
        if (d >= 1) continue;
        // Depth inside the bank: the deepest of the puffs (the top strip counts as the sky-side edge).
        let depth = x >= b.stripFrom && x <= b.stripTo && y < b.topStripPx ? y : -Infinity;
        let front = 0;
        for (const p of puffs) {
          const dx = x + 0.5 - p.x;
          const dy = y + 0.5 - p.y;
          if (Math.abs(dx) > p.r || Math.abs(dy) > p.r) continue;
          const inside = p.r - Math.hypot(dx, dy);
          depth = Math.max(depth, inside);
          if (inside > 0) front = Math.max(front, p.row);
        }
        if (depth <= 0) continue;
        const patch = 0.5 + 0.5 * Math.cos(Math.PI * d);
        const rim = Math.exp(-depth / b.flashReachPx);
        const a =
          patch * (b.flashCoreShare + (1 - b.flashCoreShare) * rim) * (b.flashRowShare[front] ?? 1);
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const i = (y * b.width + x) * 4;
        px[i] = rgb[0] ?? 255;
        px[i + 1] = rgb[1] ?? 255;
        px[i + 2] = rgb[2] ?? 255;
        px[i + 3] = Math.max(0, Math.round(a * 255 + ((seed >>> 24) / 255 - 0.5) * DITHER_AMP));
      }
    }
    ctx.putImageData(image, 0, 0);
  });
}

/** The bolt: a zig-zag with one short branch, a warm outline, a yellow body and a white-yellow core. */
function bakeBolt(scene: Phaser.Scene): void {
  const { width: w, height: h } = WEATHER_LOOK.lightning;
  const pts: Pt[] = [
    { x: w * 0.62, y: 10 },
    { x: w * 0.38, y: h * 0.25 },
    { x: w * 0.64, y: h * 0.33 },
    { x: w * 0.34, y: h * 0.58 },
    { x: w * 0.54, y: h * 0.64 },
    { x: w * 0.28, y: h * 0.86 },
    { x: w * 0.4, y: h - 10 },
  ];
  const branch: Pt[] = [
    { x: w * 0.34, y: h * 0.58 },
    { x: w * 0.62, y: h * 0.7 },
    { x: w * 0.58, y: h * 0.8 },
  ];
  bakeTexture(scene, TEX.bolt, w, h, (g) => {
    const L = WEATHER_LOOK.lightning;
    for (const [width, color] of [
      [L.rimPx, BOLT_RIM],
      [L.midPx, BOLT_MID],
      [L.corePx, BOLT_CORE],
    ] as const) {
      g.lineStyle(width, color, 1);
      g.fillStyle(color, 1);
      for (const line of [pts, branch]) {
        const stroke = width * (line === branch ? 0.7 : 1);
        g.lineStyle(stroke, color, 1);
        strokePolyline(g, line, false);
        for (const p of line) g.fillCircle(p.x, p.y, stroke / 2);
      }
    }
  });
}

/** The pictures of the snow cap: a smooth heap with a thin warm outline, rounded ends and three small drips. */
function bakeCap(scene: Phaser.Scene): void {
  const c = WEATHER_LOOK.cap;
  const outline = MOUNTAIN_LOOK.snowOutline;
  bakeTexture(scene, TEX.cap, c.width, c.height, (g) => {
    const a = c.anchorY;
    const heap: Array<[number, number]> = [];
    for (let x = 2; x <= c.width - 2; x += CAP_STEP) {
      const u = x / c.width;
      const taper = Math.sin(Math.PI * u) ** CAP_TAPER;
      const swell =
        1 +
        CAP_SWELL * Math.sin(u * TWO_PI * CAP_WAVES) +
        0.5 * CAP_SWELL * Math.sin(u * TWO_PI * CAP_WAVES * 2.3 + 1);
      heap.push([x, CAP_RADIUS * swell * taper]);
    }
    const drips = CAP_DRIPS.map((u): [number, number] => {
      const taper = Math.sin(Math.PI * u) ** CAP_TAPER;
      return [u * c.width, taper * CAP_RADIUS];
    });
    const draw = (color: number, grow: number, dy: number): void => {
      g.fillStyle(color, 1);
      for (const [x, r] of heap) if (r + grow > 0.3) g.fillCircle(x, a + dy, r + grow);
      for (const [x, r] of drips)
        g.fillCircle(x, a + dy + r * 0.6 + CAP_DRIP.reach - 5, CAP_DRIP.radius + grow);
    };
    draw(outline, CAP_OUTLINE, 1);
    draw(c.colors.shade, 0, 2);
    draw(c.colors.snow, -1.4, -2);
    // Snow on the drips stays one tone with the heap.
    g.fillStyle(c.colors.snow, 1);
    for (const [x, r] of drips)
      g.fillCircle(x, a + r * 0.6 + CAP_DRIP.reach - 6, CAP_DRIP.radius - 1.6);
  });
}

/** Bakes the pictures that fall or sit on the tower for one weather (`all` for the art sheet). */
export function bakeWeatherArt(scene: Phaser.Scene, weather: WeatherId | 'all'): void {
  const is = (...ids: WeatherId[]): boolean =>
    weather === 'all' || ids.includes(weather as WeatherId);
  if (is('snow')) {
    bakeFlakes(scene);
    bakeCap(scene);
  }
  if (is('rain', 'storm')) {
    bakeDrop(scene);
    bakeSplash(scene);
  }
  if (is('leaves')) bakeLeaves(scene);
}

/** Bakes what one zone's sky shows in this weather: the cloud bank (and bolt) or the stars and moon. */
export function bakeWeatherSky(
  scene: Phaser.Scene,
  zone: ZoneId,
  weather: WeatherId | 'all',
): void {
  const is = (...ids: WeatherId[]): boolean =>
    weather === 'all' || ids.includes(weather as WeatherId);
  if (is('night')) {
    bakeStars(scene);
    bakeMoon(scene);
  }
  if (zone !== 'roof' && zone !== 'clouds') return;
  for (const kind of ['rain', 'storm'] as const) {
    if (!is(kind)) continue;
    bakeBank(scene, bankKey(kind), kind);
    if (kind === 'storm') {
      bakeBankFlash(scene, bankFlashKey(0), 0);
      bakeBankFlash(scene, bankFlashKey(1), 1);
      bakeBolt(scene);
    }
  }
}

/** Every weather sky picture for the art sheet (the two zones share them). */
export function bakeAllWeatherSky(scene: Phaser.Scene): void {
  bakeWeatherSky(scene, 'roof', 'all');
}
