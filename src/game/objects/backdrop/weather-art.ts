import type * as Phaser from 'phaser';
import { WEATHER_LOOK, WEATHER_TEX as TEX } from '../../../data/weather-look';
import type { WeatherId } from '../../../data/weather';
import { shade } from '../../../util/color';
import { TWO_PI } from '../../../util/math';
import { fillPolygon, type Pt } from '../../fx/plain-style';
import { bakeTexture } from '../../ui/bake-texture';
import { glow } from './art-kit';

type Graphics = Phaser.GameObjects.Graphics;

const FLAKE_SIZES = [26, 38, 54] as const;
const FLAKE_CORE = 0.52;
const FLAKE_HALO = 0.5;
const DROP_W = 12;
const DROP_H = 60;
const DROP_SEGMENTS = 7;
const DROP_COLOR = 0xe6f0ff;
const LEAF_W = 56;
const LEAF_H = 36;
const LEAF_COLORS = [0xe8832e, 0xc9402f, 0xeab72a] as const;
const STAR_SIZES = [26, 36] as const;
const STAR_COLOR = 0xfff4c8;
const SPLASH_W = 56;
const SPLASH_H = 30;
const SPLASH_COLOR = 0xeaf4ff;
const MOON_SIZE = 160;
const MOON_COLOR = 0xfff1b8;
const MOON_RIM = 0xe3cf86;
const MOON_BITE = { dx: 22, dy: -10, grow: 0.9 };
const CAP_STEP = 5;
const CAP_TAPER = 0.4;
const CAP_RADIUS = 14;
const CAP_SWELL = 0.16;
const CAP_WAVES = 4.3;
const CAP_OUTLINE = 2.2;
const BOLT_COLOR = 0xfffbe0;
const BOLT_GLOW = 0xbfd0ff;

function bakeFlakes(scene: Phaser.Scene): void {
  FLAKE_SIZES.forEach((size, i) => {
    bakeTexture(scene, TEX.flake[i] ?? '', size, size, (g) => {
      const c = size / 2;
      glow(g, c, c, c, 0xffffff, FLAKE_HALO);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(c, c, c * FLAKE_CORE);
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

/** Points of a pointed oval leaf from tip to tip, `lower` picks the lower half. */
function leafHalf(lower: boolean): Pt[] {
  const sign = lower ? 1 : -1;
  const pts: Pt[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      x: 4 + (LEAF_W - 12) * t,
      y: LEAF_H / 2 + sign * Math.sin(Math.PI * t) ** 0.85 * (LEAF_H / 2 - 3),
    });
  }
  return pts;
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

function bakeLeaves(scene: Phaser.Scene): void {
  LEAF_COLORS.forEach((color, i) => {
    bakeTexture(scene, TEX.leaf[i] ?? '', LEAF_W, LEAF_H, (g) => {
      const upper = leafHalf(false);
      const lower = leafHalf(true);
      const outline = shade(color, -0.4);
      const dark = shade(color, -0.16);
      g.lineStyle(3, outline, 1);
      const outlinePts = [...upper, ...lower.slice().reverse()];
      g.fillStyle(color, 1);
      fillPolygon(g, outlinePts);
      strokePolyline(g, outlinePts, true);
      g.fillStyle(dark, 1);
      fillPolygon(g, [
        ...lower,
        ...upper
          .slice()
          .reverse()
          .map((p) => ({ x: p.x, y: LEAF_H / 2 })),
      ]);
      g.lineStyle(2.4, shade(color, 0.28), 0.9);
      g.lineBetween(7, LEAF_H / 2, LEAF_W - 14, LEAF_H / 2);
      g.lineStyle(3, outline, 1);
      g.lineBetween(LEAF_W - 12, LEAF_H / 2, LEAF_W - 3, LEAF_H / 2 + 2);
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

function bakeStars(scene: Phaser.Scene): void {
  STAR_SIZES.forEach((size, i) => {
    bakeTexture(scene, TEX.star[i] ?? '', size, size, (g) => {
      const c = size / 2;
      glow(g, c, c, c * 0.8, STAR_COLOR, 0.45);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(c, c, size * 0.1);
      g.fillStyle(STAR_COLOR, 0.8);
      g.fillEllipse(c, c, size * 0.9, 2.2);
      g.fillEllipse(c, c, 2.2, size * 0.9);
    });
  });
}

function bakeMoon(scene: Phaser.Scene): void {
  const c = MOON_SIZE / 2;
  const r = WEATHER_LOOK.night.moon.radius;
  bakeTexture(
    scene,
    TEX.moon,
    MOON_SIZE,
    MOON_SIZE,
    (g) => {
      glow(g, c, c, c, MOON_COLOR, WEATHER_LOOK.night.moon.haloAlpha);
      g.fillStyle(MOON_RIM, 1);
      g.fillCircle(c, c, r * 0.8);
      g.fillStyle(MOON_COLOR, 1);
      g.fillCircle(c - 2, c - 2, r * 0.8 - 3.5);
    },
    (ctx) => {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(c + MOON_BITE.dx, c + MOON_BITE.dy, r * MOON_BITE.grow * 0.8, 0, Math.PI * 2);
      ctx.fill();
    },
  );
}

function drawBank(g: Graphics, color: number, grow: number, alpha: number): void {
  const b = WEATHER_LOOK.bank;
  g.fillStyle(color, alpha);
  g.fillRect(0, -10, b.width, b.bodyBottom + grow);
  for (const [x, y, r] of b.lumps) g.fillEllipse(x, y, (r + grow) * 3.1, (r + grow) * 1.8);
}

function bakeBank(scene: Phaser.Scene, key: string, color: number): void {
  const b = WEATHER_LOOK.bank;
  bakeTexture(scene, key, b.width, b.height, (g) => {
    drawBank(g, color, b.haloGrow, b.haloAlpha);
    drawBank(g, color, 0, 1);
  });
}

function bakeBolt(scene: Phaser.Scene): void {
  const { width: w, height: h } = WEATHER_LOOK.lightning;
  const pts: Pt[] = [
    { x: w * 0.55, y: 4 },
    { x: w * 0.4, y: h * 0.22 },
    { x: w * 0.6, y: h * 0.3 },
    { x: w * 0.36, y: h * 0.52 },
    { x: w * 0.5, y: h * 0.58 },
    { x: w * 0.3, y: h * 0.8 },
    { x: w * 0.38, y: h - 6 },
  ];
  bakeTexture(scene, TEX.bolt, w, h, (g) => {
    for (const [width, color, alpha] of [
      [22, BOLT_GLOW, 0.22],
      [11, BOLT_GLOW, 0.45],
      [5, BOLT_COLOR, 1],
    ] as const) {
      g.lineStyle(width, color, alpha);
      strokePolyline(g, pts, false);
    }
  });
}

function bakeCap(scene: Phaser.Scene): void {
  const c = WEATHER_LOOK.cap;
  bakeTexture(scene, TEX.cap, c.width, c.height, (g) => {
    const a = c.anchorY;
    // One soft heap: overlapping discs along a line, radius swelling slowly and tapering to round ends.
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
    const draw = (color: number, grow: number, dy: number): void => {
      g.fillStyle(color, 1);
      for (const [x, r] of heap) if (r > 0.5) g.fillCircle(x, a + dy, r + grow);
    };
    draw(c.colors.outline, CAP_OUTLINE, 1);
    draw(c.colors.shade, 0, 2.5);
    draw(c.colors.snow, -1.5, -2.5);
  });
}

/** Bakes the weather pictures one weather needs (`all` for the art sheet). Nothing else is baked at run load. */
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
  if (is('rain')) bakeBank(scene, TEX.bankRain, WEATHER_LOOK.bank.colorRain);
  if (is('storm')) {
    bakeBank(scene, TEX.bankStorm, WEATHER_LOOK.bank.colorStorm);
    bakeBank(scene, TEX.bankFlash, WEATHER_LOOK.bank.colorFlash);
    bakeBolt(scene);
  }
  if (is('leaves')) bakeLeaves(scene);
  if (is('night')) {
    bakeStars(scene);
    bakeMoon(scene);
  }
}
