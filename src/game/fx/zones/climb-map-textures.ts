import type * as Phaser from 'phaser';
import { BALANCE } from '../../../data/tower/balance';
import { CLIMB_MAP } from '../../../data/progression/climb-map';
import { PLAIN_PAIRS, SPONGES } from '../../../data/tower/plain-layers';
import { ZONE_SKY } from '../../../data/backdrop/backdrop-colors';
import type { ZoneId } from '../../../data/zones/zones';
import { mixColor, shade } from '../../../util/color';
import { gradientColorAt } from '../../objects/backdrop/common/sky-gradient';
import { starPoints } from '../../objects/creatures/creature-art/rainbow-geometry';
import { bakeTexture } from '../../ui/common/bake-texture';
import {
  drawFace,
  drawGlossMark,
  drawTwoToneBody,
  ellipsePoints,
  fillPolygon,
  outlineColor,
  roundRectPoints,
  type BodyShape,
} from '../common/plain-style';

const cfg = CLIMB_MAP;
/** Layers of a band as the column draws them: every drawn layer stands for `tower.perLayer` real ones. */
const LAYERS = BALANCE.zones.length / cfg.tower.perLayer;

export const CLIMB_TOWER_KEY = 'climb_map_tower';
export const CLIMB_POLE_KEY = 'climb_map_pole';
export const CLIMB_KNOB_KEY = 'climb_map_knob';
export const CLIMB_STAR_KEY = 'climb_map_star';
export const CLIMB_BAR_KEY = 'climb_map_bar';
export const CLIMB_TOP_KEY = 'climb_map_top';

/** Key of the sky strip of a band: the zone sky, or the shut one. */
export function climbSkyKey(zone: ZoneId | 'locked'): string {
  return `climb_map_sky_${zone}`;
}

/** Size of the tower picture: its width, its height and the free field above and under the layers. */
export function climbTowerSize(): { width: number; height: number; layer: number; pad: number } {
  const layer = (cfg.bandHeight / LAYERS) * cfg.tower.texScale;
  const pad = cfg.tower.pad;
  return {
    width: cfg.tower.width * cfg.tower.texScale,
    height: layer * LAYERS + pad * 2,
    layer,
    pad,
  };
}

const roundShape =
  (share: number): BodyShape =>
  (cx, cy, rx, ry) =>
    roundRectPoints(cx, cy, rx, ry, Math.min(rx, ry) * share);

/** A tiny repeatable noise in 0..1 for the wobble of the layers. */
function wobbleAt(i: number, k: number): number {
  const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** One small cake layer of the column, drawn like the plain layers of the run: crust, sponge, wavy glaze, drips, gloss. */
function drawTowerLayer(
  g: Phaser.GameObjects.Graphics,
  i: number,
  bottom: number,
  face = false,
): void {
  const t = cfg.tower;
  const size = climbTowerSize();
  const pair = PLAIN_PAIRS[(i * t.pairStep) % PLAIN_PAIRS.length] ?? PLAIN_PAIRS[0];
  if (!pair) return;
  const sponge = SPONGES[pair.sponge];
  const grow = t.outline;
  const half = (size.width - size.pad * 2) / 2 - grow - t.wobble;
  const rx = half + (wobbleAt(i, 1) - 0.5) * t.wobble;
  const cx = size.width / 2 + (wobbleAt(i, 2) - 0.5) * t.wobble * 0.5;
  const ry = size.layer / 2 - 1;
  const cy = bottom - size.layer / 2;
  drawTwoToneBody(g, roundShape(0.5), cx, cy, rx, ry, {
    base: sponge.cake,
    shadow: shade(sponge.cake, t.shadowShade),
    grow,
    band: t.band,
  });
  // The pores: three small dots of the pore tone on the lower sponge.
  g.fillStyle(sponge.pore, 0.85);
  for (let k = 0; k < (face ? 0 : 3); k++) {
    const px = cx + (wobbleAt(i, 10 + k) - 0.5) * rx * 1.5;
    fillPolygon(g, ellipsePoints(px, cy + ry * 0.62, t.poreSize * 1.4, t.poreSize, 0));
  }
  // The glaze: a cap along the top with a wavy lower edge and two drips, outline pass first.
  const glazeH = size.layer * (face ? t.topGlazeShare : t.glazeShare);
  const top = cy - ry;
  const edge = top + glazeH * 0.62;
  const bumps = 6;
  const parts = [
    roundRectPoints(cx, top + glazeH * 0.36, rx * 0.99, glazeH * 0.36, glazeH * 0.34),
    ...Array.from({ length: bumps }, (_, k) => {
      const bx = cx - rx * 0.8 + (rx * 1.6 * (k + 0.5)) / bumps;
      const by = edge + (k % 2 === 0 ? 1 : -1.5);
      return ellipsePoints(bx, by, (rx * 0.9) / bumps + 1.5, glazeH * 0.3, 0);
    }),
    ...[0.26, 0.7].map((share, k) => {
      const dx = cx - rx + rx * 2 * share + (wobbleAt(i, 20 + k) - 0.5) * 8;
      const len = t.dripLength * (0.8 + wobbleAt(i, 30 + k) * 0.5);
      return roundRectPoints(dx, edge + len / 2, t.dripWidth / 2, len, t.dripWidth / 2);
    }),
  ];
  g.fillStyle(outlineColor(pair.glaze), 1);
  for (const part of parts) {
    const c = part.reduce((a, p) => ({ x: a.x + p.x / part.length, y: a.y + p.y / part.length }), {
      x: 0,
      y: 0,
    });
    fillPolygon(
      g,
      part.map((p) => ({
        x: p.x + Math.sign(p.x - c.x) * t.glazeOutline,
        y: p.y + Math.sign(p.y - c.y) * t.glazeOutline,
      })),
    );
  }
  g.fillStyle(shade(pair.glaze, -0.14), 1);
  for (const part of parts) fillPolygon(g, part);
  g.fillStyle(pair.glaze, 1);
  for (const part of parts) {
    fillPolygon(
      g,
      part.map((p) => ({ x: p.x - 0.8, y: p.y - 1.2 })),
    );
  }
  // A soft shadow down the right side, then the face of the top cake.
  g.fillStyle(0x000000, t.sideShadow);
  fillPolygon(g, roundRectPoints(cx + rx * 0.86, cy, rx * 0.14, ry * 0.92, rx * 0.14));
  if (face) {
    drawFace(g, size.layer, cx, cy + ry * 0.42, t.face, shade(sponge.outline, -0.5));
  }
  drawGlossMark(g, {
    x: cx - rx * 0.5,
    y: top + glazeH * 0.3,
    length: size.layer * 0.5,
    thick: size.layer * 0.1,
    tilt: 0,
    dotGap: size.layer * 0.16,
    dotRadius: size.layer * 0.05,
    color: 0xffffff,
    alpha: 0.85,
  });
}

function bakeTower(scene: Phaser.Scene): void {
  const size = climbTowerSize();
  bakeTexture(scene, CLIMB_TOWER_KEY, size.width, size.height, (g) => {
    for (let i = 0; i < LAYERS; i++) drawTowerLayer(g, i, size.height - size.pad - i * size.layer);
  });
}

/** Size of the top cake picture: one layer of the column with the field round it. */
export function climbTopSize(): { width: number; height: number } {
  const size = climbTowerSize();
  return { width: size.width, height: size.layer + size.pad * 2 };
}

/** The cake on top of the tower at the record height: one more layer, with a small face. */
function bakeTop(scene: Phaser.Scene): void {
  const size = climbTowerSize();
  const top = climbTopSize();
  bakeTexture(scene, CLIMB_TOP_KEY, top.width, top.height, (g) => {
    drawTowerLayer(g, 0, top.height - size.pad, true);
  });
}

/** The sky strip of a band: gradient, a light line on top and the ledge the band stands on. */
function bakeSky(scene: Phaser.Scene, key: string, colorAt: (t: number) => number): void {
  const s = cfg.sky;
  const h = cfg.bandHeight;
  const row = 4;
  bakeTexture(scene, key, s.textureWidth, h, (g) => {
    for (let y = 0; y < h; y += row) {
      g.fillStyle(colorAt((y + row / 2) / h), 1).fillRect(0, y, s.textureWidth, row + 1);
    }
    g.fillStyle(0xffffff, s.topLight).fillRect(0, 0, s.textureWidth, s.topLightHeight);
    const foot = colorAt(1);
    g.fillStyle(shade(foot, s.ledgeShade), 1).fillRect(0, h - s.ledge, s.textureWidth, s.ledge);
    g.fillStyle(shade(foot, s.lineShade), 1).fillRect(0, h - s.ledge, s.textureWidth, 3);
  });
}

function bakeSkies(scene: Phaser.Scene): void {
  for (const zone of Object.keys(ZONE_SKY) as ZoneId[]) {
    const stops = ZONE_SKY[zone];
    const [from, to] = cfg.sky.range[zone] ?? [0, 1];
    bakeSky(scene, climbSkyKey(zone), (t) => gradientColorAt(stops, from + (to - from) * t));
  }
  const [from, to] = cfg.locked.sky;
  bakeSky(scene, climbSkyKey('locked'), (t) => mixColor(from, to, t));
}

/** A round body in two tones with an outline (the knob of a pole). */
function bakeKnob(scene: Phaser.Scene): void {
  const size = cfg.flag.knob * 2;
  const pad = 6;
  bakeTexture(scene, CLIMB_KNOB_KEY, size, size, (g) => {
    const r = size / 2 - pad;
    drawTwoToneBody(
      g,
      (cx, cy, rx, ry) => ellipsePoints(cx, cy, rx, ry, 0),
      size / 2,
      size / 2,
      r,
      r,
      {
        base: 0xffc93c,
        shadow: shade(0xffc93c, -0.2),
        grow: 3,
        band: 0.16,
      },
    );
    drawGlossMark(g, {
      x: size / 2 - r * 0.38,
      y: size / 2 - r * 0.42,
      length: r * 0.5,
      thick: r * 0.2,
      tilt: -0.7,
      dotGap: r * 0.2,
      dotRadius: r * 0.1,
      color: 0xffffff,
      alpha: 0.85,
    });
  });
}

/** A shaft of a pole, to be stretched along its length: outline, shadow side and the lit side. */
function bakePole(scene: Phaser.Scene): void {
  const w = cfg.flag.poleWidth + 12;
  const h = 24;
  const body = cfg.flag.poleWidth;
  const base = 0xd9a066;
  bakeTexture(scene, CLIMB_POLE_KEY, w, h, (g) => {
    const x = (w - body) / 2;
    g.fillStyle(outlineColor(base), 1).fillRect(x - 3, 0, body + 6, h);
    g.fillStyle(shade(base, cfg.flag.poleShade), 1).fillRect(x, 0, body, h);
    g.fillStyle(base, 1).fillRect(x, 0, body * 0.62, h);
  });
}

/** The star of the best lap: a gold five-pointed body with an outline and a gloss. */
function bakeStar(scene: Phaser.Scene): void {
  const s = cfg.star;
  const size = s.size;
  bakeTexture(scene, CLIMB_STAR_KEY, size, size, (g) => {
    const r = size / 2 - s.outline - 3;
    drawTwoToneBody(
      g,
      (cx, cy, rx) => starPoints(cx, cy + rx * 0.06, rx, s.inner),
      size / 2,
      size / 2,
      r,
      r,
      {
        base: s.fill,
        shadow: shade(s.fill, -0.22),
        grow: s.outline,
        band: 0.1,
      },
    );
    drawGlossMark(g, {
      x: size / 2 - r * 0.28,
      y: size / 2 - r * 0.28,
      length: r * 0.36,
      thick: r * 0.11,
      tilt: -0.75,
      dotGap: r * 0.12,
      dotRadius: r * 0.05,
      color: 0xffffff,
      alpha: 0.9,
    });
  });
}

/** The capsule of the scroll bar (white; the bar tints it): stretched along its length as a 3-slice. */
function bakeBar(scene: Phaser.Scene): void {
  const { width } = cfg.bar;
  const w = width + 8;
  const h = width * 4;
  bakeTexture(scene, CLIMB_BAR_KEY, w, h, (g) => {
    g.fillStyle(0xffffff, 1);
    fillPolygon(g, roundRectPoints(w / 2, h / 2, width / 2, h / 2 - 4, width / 2));
  });
}

/** Bakes every picture of the climb map that does not depend on the window size (lazy: only the first call draws). */
export function bakeClimbMapTextures(scene: Phaser.Scene): void {
  bakeTower(scene);
  bakeTop(scene);
  bakeSkies(scene);
  bakeKnob(scene);
  bakePole(scene);
  bakeStar(scene);
  bakeBar(scene);
}

/** Key of the rim round the ribbon for a ribbon `width` x `height`. */
export function climbFrameKey(width: number, height: number): string {
  return `climb_map_frame_${Math.round(width)}x${Math.round(height)}`;
}

/**
 * Bakes the rim round the ribbon (once per size): a thick rounded frame with a square hole, so
 * it covers the corners of the bands. Outline, body, a light edge along the top, a dark line on
 * the inside.
 */
export function bakeClimbFrame(scene: Phaser.Scene, width: number, height: number): string {
  const f = cfg.frame;
  const key = climbFrameKey(width, height);
  const w = Math.round(width);
  const h = Math.round(height);
  const outline = 4;
  const inner = 3;
  bakeTexture(
    scene,
    key,
    w,
    h,
    (g) => {
      g.fillStyle(shade(f.fill, f.outlineShade), 1);
      fillPolygon(g, roundRectPoints(w / 2, h / 2, w / 2, h / 2, f.radius));
      g.fillStyle(shade(f.fill, f.darkShade), 1);
      fillPolygon(
        g,
        roundRectPoints(w / 2, h / 2, w / 2 - outline, h / 2 - outline, f.radius - outline),
      );
      g.fillStyle(f.fill, 1);
      fillPolygon(
        g,
        roundRectPoints(
          w / 2 - 1,
          h / 2 - 1.5,
          w / 2 - outline - 2,
          h / 2 - outline - 2.5,
          f.radius - outline - 2,
        ),
      );
      g.fillStyle(shade(f.fill, f.lightShade), 0.7);
      g.fillRoundedRect(f.radius, outline + 2, w - f.radius * 2, 3, 1.5);
      g.fillStyle(shade(f.fill, f.outlineShade), 1);
      g.fillRect(
        f.thick - inner,
        f.thick - inner,
        w - (f.thick - inner) * 2,
        h - (f.thick - inner) * 2,
      );
    },
    (context) => context.clearRect(f.thick, f.thick, w - f.thick * 2, h - f.thick * 2),
  );
  return key;
}
