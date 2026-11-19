import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/common/anim';
import { FLIGHT_CLEAR } from '../../data/backdrop/flight-clear';
import { HUD_LAYOUT } from '../../data/run/hud-layout';
import { RULE_ANIM } from '../../data/zones/rule-anim';
import { LOGICAL_SIZE } from '../../data/app/screen';
import { flightRowY, riseRoom } from './cloud-figure';
import {
  armAxisY,
  armPoints,
  armWidth,
  coreDim,
  curlTurns,
  nebulaFrameRects,
  nebulaHeadroom,
  nebulaLayout,
  nebulaTop,
  LAYER_HALF,
  ROW_HALF,
  veilAlpha,
  type ArmPoint,
  type NebulaLayout,
} from './nebula-arms';

const cloud = RULE_ANIM.cloud;
const figure = cloud.figure;
const N = cloud.nebula;
const SHORT = Math.max(LOGICAL_SIZE.minHeight, Math.round((693 * LOGICAL_SIZE.width) / 390));
const TALL = Math.round((844 * LOGICAL_SIZE.width) / 390);
const PLATES_BOTTOM = Math.max(...HUD_LAYOUT.plates.map((p) => p.y + p.height));
const NEXT_PLATE = HUD_LAYOUT.plates[5];
const tall = nebulaLayout(TALL);
const short = nebulaLayout(SHORT);

/** Screen y of the top of the nebula on a screen `screenH` tall, at the highest bob and widest breath. */
function highestTop(screenH: number): number {
  const centre = flightRowY(screenH) - ANIM.flying.bobAmplitude - cloud.bobPx;
  return centre - nebulaTop(nebulaLayout(screenH)) * figure.scale * (1 + cloud.breathe);
}

function bounds(pts: readonly ArmPoint[]): { w: number; h: number } {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

function heading(pts: readonly ArmPoint[]): number {
  const a = pts[0];
  const b = pts[1];
  return a && b ? Math.atan2(b.y - a.y, b.x - a.x) : 0;
}

describe('nebula arms', () => {
  it('cross once, in the middle, on the row centre, in antiphase, on every screen', () => {
    for (const layout of [tall, short]) {
      expect(armAxisY('pink', 0, layout)).toBeCloseTo(0);
      expect(armAxisY('blue', 0, layout)).toBeCloseTo(0);
      const reach = Math.min(N.arms.pink.reach, N.arms.blue.reach);
      for (let u = -reach + 2; u < reach - 1; u += 2) {
        if (Math.abs(u) < 1) continue;
        // Where the pink arm is up the blue one is down: they never meet away from the middle.
        expect(Math.sign(armAxisY('pink', u, layout))).toBe(
          -Math.sign(armAxisY('blue', u, layout)),
        );
      }
    }
  });

  it('makes the pink arm the thicker one, widest in the middle and tapering to the ends', () => {
    expect(armWidth('pink', 0)).toBeGreaterThan(armWidth('blue', 0));
    for (const arm of ['pink', 'blue'] as const) {
      const reach = N.arms[arm].reach;
      let last = armWidth(arm, 0);
      for (let u = 10; u <= reach; u += 10) {
        expect(armWidth(arm, u)).toBeLessThanOrEqual(last);
        last = armWidth(arm, u);
      }
      expect(armWidth(arm, reach)).toBeLessThan(armWidth(arm, 0) * 0.6);
    }
  });

  it('curls the pink ends into round spirals of 1.5 turns and the blue ends into hooks the other way', () => {
    for (const layout of [tall, short]) {
      const pink = armPoints('pink', layout);
      const blue = armPoints('blue', layout);
      const turns = curlTurns(pink.right, heading(pink.right));
      expect(Math.abs(turns)).toBeGreaterThan(1.4);
      expect(Math.abs(turns)).toBeLessThan(1.6);
      const hook = curlTurns(blue.right, heading(blue.right));
      expect(Math.abs(hook)).toBeLessThan(0.6);
      expect(Math.sign(hook)).toBe(-Math.sign(turns));
      // Round on every screen: a short one re-lays the curve lower, it does not squash it.
      const size = bounds(pink.right);
      expect(size.w / size.h).toBeGreaterThan(0.75);
      expect(size.w / size.h).toBeLessThan(1.35);
      expect(pink.right[pink.right.length - 1]?.end).toBeCloseTo(1);
      // The spirals lie inside the screen with the figure at rest and drifted.
      const half = LOGICAL_SIZE.width / 2 / figure.scale;
      const drift = (cloud.driftPx + cloud.swayPx) / figure.scale;
      for (const p of [...pink.right, ...pink.left]) {
        expect(Math.abs(p.x)).toBeLessThan(half - drift);
      }
    }
  });

  it('keeps the arms as thick on a short screen, only the wave is lower', () => {
    expect(short.fit).toBeLessThan(1);
    expect(short.fit).toBeGreaterThan(0.1);
    const thick = (layout: NebulaLayout): number =>
      Math.max(...armPoints('pink', layout).main.map((p) => p.w));
    expect(thick(short)).toBeCloseTo(thick(tall), 3);
    expect(short.amplitude.pink).toBeLessThan(tall.amplitude.pink);
  });

  it('mutes the layer the same everywhere along the row: the veil is opaque over the whole cover row', () => {
    expect(tall.veilCore).toBe(ROW_HALF);
    // A short screen keeps it opaque over the layer itself with both bobs, so its edge can melt softly.
    // ... and the layer stays under it when the bank stands lower by the layer's bob (`verticalRoom.drop`).
    expect(short.veilCore).toBeGreaterThanOrEqual(
      LAYER_HALF + ANIM.flying.bobAmplitude / figure.scale - 1e-9,
    );
    expect(short.veilFade).toBeGreaterThanOrEqual(18);
    for (const layout of [tall, short]) {
      for (let x = figure.body.left; x <= figure.body.right; x += 7) {
        for (let y = -layout.veilCore; y <= layout.veilCore; y += 5) {
          expect(veilAlpha(x - figure.width / 2, y, layout)).toBe(1);
        }
      }
    }
    // The contrast of the layer under it is 1 - the density cap everywhere: about 0.32.
    expect(1 - N.maxDensity).toBeCloseTo(0.32);
    // Nothing of the veil at the picture edges.
    expect(veilAlpha(-figure.width / 2 + 2, 0, tall)).toBe(0);
    expect(veilAlpha(0, figure.height / 2 - 2, tall)).toBe(0);
  });

  it('melts the veil away above the row over a reach that swells along it: no straight edge', () => {
    const y = -(ROW_HALF + N.veil.fade * 0.4);
    const along: number[] = [];
    for (let u = -380; u <= 380; u += 4) along.push(veilAlpha(u, y, tall));
    expect(Math.max(...along) - Math.min(...along)).toBeGreaterThan(0.2);
    // Soft: from the row edge it falls over tens of px, not a few.
    expect(veilAlpha(0, -(ROW_HALF + 20), tall)).toBeGreaterThan(0.1);
  });

  it('dims the light of the arms at the crossing so the core does not burn white', () => {
    expect(coreDim(0)).toBeCloseTo(1 - N.core.cap);
    expect(coreDim(1)).toBe(1);
    expect(coreDim(0.5)).toBeGreaterThan(coreDim(0.2));
  });

  it('cuts every picture to what it holds, inside the figure frame', () => {
    for (const layout of [tall, short]) {
      const rects = nebulaFrameRects(layout);
      for (const r of Object.values(rects)) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.w).toBeLessThanOrEqual(figure.width);
        expect(r.y + r.h).toBeLessThanOrEqual(figure.height);
      }
      expect(rects.pink.w).toBeLessThan(figure.width);
      expect(rects.blue.h).toBeLessThan(figure.height);
    }
    expect(nebulaTop(tall)).toBeLessThanOrEqual(figure.height / 2 - 3);
  });

  it('draws the full picture on a 390x844 screen, the HUD gap under the plates', () => {
    expect(tall.fit).toBe(1);
    expect(highestTop(TALL)).toBeGreaterThanOrEqual(PLATES_BOTTOM + FLIGHT_CLEAR.hudGapPx);
  });

  it('lays the drawing just low enough on shorter screens, down to the cloud top on 390x693', () => {
    for (let h = SHORT; h <= LOGICAL_SIZE.maxHeight; h += 20) {
      expect(nebulaTop(nebulaLayout(h))).toBeLessThanOrEqual(nebulaHeadroom(h) + 0.01);
      if (riseRoom(h) > 0) {
        expect(highestTop(h)).toBeGreaterThanOrEqual(PLATES_BOTTOM + FLIGHT_CLEAR.hudGapPx - 0.5);
      }
    }
    expect(NEXT_PLATE).toBeDefined();
    if (!NEXT_PLATE) return;
    const restTop = flightRowY(SHORT) - nebulaTop(short) * figure.scale;
    expect(restTop - (NEXT_PLATE.y + NEXT_PLATE.height)).toBeGreaterThanOrEqual(
      FLIGHT_CLEAR.hudGapPx,
    );
  });
});
