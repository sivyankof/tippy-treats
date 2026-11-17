import type * as Phaser from 'phaser';
import {
  CLIP_ALLOWED,
  CLIP_MIN_SPARE,
  CLIP_PROBE_PAD,
  CLIP_SIDES,
  type ClipSide,
} from '../data/clip-guard';
import { readDebugParams } from '../util/debug-params';
import { measureOverflow } from '../util/edge-clip';

/** One picture whose drawing runs past its field: its key, the side and how many pixels lie beyond it. */
export interface ClipOffender {
  key: string;
  side: ClipSide;
  pixels: number;
  /** How far the farthest pixel is from the field, px. */
  reach: number;
}

/** A picture with less than `CLIP_MIN_SPARE` free pixels on some side: the tightest sides and their spare. */
export interface ClipTight {
  key: string;
  sides: Partial<Record<ClipSide, number>>;
}

/** Only the art sheet page (dev build) probes pictures: a second drawing of every picture costs too much in a run. */
const active =
  import.meta.env.DEV && typeof window !== 'undefined' && readDebugParams().artsheet === true;
const found = new Map<string, ClipOffender[]>();
/** Pictures that do not run past the field but come closer to its edge than `CLIP_MIN_SPARE`: the key and the free pixels per side. */
const tight = new Map<string, ClipTight>();
const checked = new Set<string>();

/** The sides of `key` that may run past the field. */
function allowedSides(key: string): ClipSide[] {
  const sides = new Set<ClipSide>();
  for (const entry of CLIP_ALLOWED) {
    if (!entry.match.test(key)) continue;
    for (const side of entry.sides ?? CLIP_SIDES) sides.add(side);
  }
  return [...sides];
}

/** True on the art sheet page of the dev build, where pictures are probed. */
export function clipGuardActive(): boolean {
  return active;
}

/**
 * Draws a picture a second time into a field `CLIP_PROBE_PAD` bigger on every side and counts what
 * lands in the margin: that is the part of the drawing the real field cuts off. Call it with the
 * same `draw` the bake uses, right after the bake.
 */
export function probeClip(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (!active) return;
  const w = Math.ceil(width);
  const h = Math.ceil(height);
  const pad = CLIP_PROBE_PAD;
  const g = scene.add.graphics().setVisible(false);
  try {
    g.translateCanvas(pad, pad);
    draw(g);
    const canvas = document.createElement('canvas');
    canvas.width = w + pad * 2;
    canvas.height = h + pad * 2;
    g.generateTexture(canvas, canvas.width, canvas.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return;
    checked.add(key);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const overflow = measureOverflow(data, w, h, pad);
    const allowed = allowedSides(key);
    const list = CLIP_SIDES.filter(
      (side) => overflow[side].pixels > 0 && !allowed.includes(side),
    ).map((side) => ({ key, side, pixels: overflow[side].pixels, reach: overflow[side].reach }));
    if (list.length > 0) found.set(key, list);
    else found.delete(key);
    const sides: Partial<Record<ClipSide, number>> = {};
    for (const side of CLIP_SIDES) {
      const spare = overflow[side].spare;
      if (spare >= 0 && spare < CLIP_MIN_SPARE && !allowed.includes(side)) sides[side] = spare;
    }
    if (Object.keys(sides).length > 0 && list.length === 0) tight.set(key, { key, sides });
    else tight.delete(key);
  } finally {
    g.destroy();
  }
}

/** Every picture probed so far that runs past its field, in key order. */
export function clipOffenders(): ClipOffender[] {
  return [...found.values()].flat().sort((a, b) => a.key.localeCompare(b.key));
}

/** The pictures that stay in the field but come closer to its edge than `CLIP_MIN_SPARE`, in key order. */
export function clipTight(): ClipTight[] {
  return [...tight.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** The summary: `clip: ok` or `clip: N offenders` and the list (the pictures that are only tight are counted, listed by `clipTightLines`). */
export function clipSummary(): string {
  const list = clipOffenders();
  const near = `${tight.size} closer than ${CLIP_MIN_SPARE}px to the edge`;
  const head = list.length === 0 ? 'clip: ok' : `clip: ${list.length} offenders`;
  const lines = list.map((o) => `  ${o.key} ${o.side} ${o.pixels}px reach ${o.reach}px`);
  return [`${head} (${checked.size} pictures checked, ${near})`, ...lines].join('\n');
}

/** One line per tight picture: key and the free pixels of its tight sides. */
export function clipTightLines(): string[] {
  return clipTight().map(
    (t) =>
      `  ${t.key} ${Object.entries(t.sides)
        .map(([side, spare]) => `${side} ${spare}`)
        .join(', ')}`,
  );
}
