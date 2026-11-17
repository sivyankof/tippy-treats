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

type Graphics = Phaser.GameObjects.Graphics;

const FLAKE_SIZES = [10, 15, 22] as const;
const FLAKE_OUTLINE = 0xb4c4de;
const DROP_W = 12;
const DROP_H = 60;
const DROP_SEGMENTS = 7;
const DROP_COLOR = 0xe6f0ff;
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
const FLASH_LOBE_SIZE = 128;
const BOLT_CORE = 0xfffbe6;
const BOLT_RIM = 0xcfdcff;

/** Key of the cloud bank picture of a weather (the same in both zones), and of its pale flash twin. */
export function bankKey(weather: WeatherId, flash = false): string {
  if (flash) return TEX.bankFlash;
  return weather === 'storm' ? TEX.bankStorm : TEX.bankRain;
}

function bakeFlakes(scene: Phaser.Scene): void {
  FLAKE_SIZES.forEach((size, i) => {
    bakeTexture(scene, TEX.flake[i] ?? '', size, size, (g) => {
      const c = size / 2;
      g.fillStyle(FLAKE_OUTLINE, 1);
      g.fillCircle(c, c, c);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(c, c, c - 1.4);
    });
  });
}

function bakeDrop(scene: Phaser.Scene): void {
  bakeTexture(scene, TEX.drop, DROP_W, DROP_H, (g) => {
    const seg = DROP_H / DROP_SEGMENTS;
    for (let i = 0; i < DROP_SEGMENTS; i++) {
      const t = (i + 1) / DROP_SEGMENTS;
      g.fillStyle(DROP_COLOR, 0.12 + 0.5 * t * t);
      g.fillEllipse(DROP_W / 2, seg * (i + 0.5) + seg * 0.3, 2 + 3.2 * t, seg * 1.9);
    }
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(DROP_W / 2, DROP_H - 5, 2.6);
  });
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

/** The pale lobe that lights the cloud around a bolt: one flat ellipse. */
function bakeFlashLobe(scene: Phaser.Scene, key: string, color: number): void {
  const size = FLASH_LOBE_SIZE;
  bakeTexture(scene, key, size, size, (g) => {
    g.fillStyle(color, 1);
    g.fillEllipse(size / 2, size / 2, size, size);
  });
}

/** One opaque figure: a band along the top edge and the lobes that hang from it, all one flat colour. */
function bakeBank(scene: Phaser.Scene, key: string, color: number): void {
  const b = WEATHER_LOOK.bank;
  bakeTexture(scene, key, b.width, b.height, (g) => {
    g.fillStyle(color, 1);
    g.fillRect(0, -10, b.width, b.bodyBottom);
    for (const [x, y, r] of b.lumps) g.fillEllipse(x, y, r * b.lobeWide, r * b.lobeTall);
  });
}

function bakeBolt(scene: Phaser.Scene): void {
  const { width: w, height: h } = WEATHER_LOOK.lightning;
  const pts: Pt[] = [
    { x: w * 0.58, y: 8 },
    { x: w * 0.4, y: h * 0.24 },
    { x: w * 0.62, y: h * 0.32 },
    { x: w * 0.36, y: h * 0.55 },
    { x: w * 0.52, y: h * 0.61 },
    { x: w * 0.3, y: h * 0.82 },
    { x: w * 0.4, y: h - 8 },
  ];
  bakeTexture(scene, TEX.bolt, w, h, (g) => {
    for (const [width, color] of [
      [WEATHER_LOOK.lightning.rimPx, BOLT_RIM],
      [WEATHER_LOOK.lightning.corePx, BOLT_CORE],
    ] as const) {
      g.lineStyle(width, color, 1);
      strokePolyline(g, pts, false);
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
    const color = bankColor(kind);
    bakeBank(scene, bankKey(kind), color);
    if (kind === 'storm') {
      bakeFlashLobe(
        scene,
        bankKey(kind, true),
        mixColor(color, WEATHER_LOOK.bank.flashColor, WEATHER_LOOK.bank.flashMix),
      );
      bakeBolt(scene);
    }
  }
}

/** Every weather sky picture for the art sheet (the two zones share them). */
export function bakeAllWeatherSky(scene: Phaser.Scene): void {
  bakeWeatherSky(scene, 'roof', 'all');
}
