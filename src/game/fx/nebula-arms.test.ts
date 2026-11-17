import { describe, expect, it } from 'vitest';
import { ANIM } from '../../data/anim';
import { FLIGHT_CLEAR } from '../../data/flight-clear';
import { HUD_LAYOUT } from '../../data/hud-layout';
import { RULE_ANIM } from '../../data/rule-anim';
import { LOGICAL_SIZE } from '../../data/screen';
import { flightRowY, riseRoom } from './cloud-figure';
import {
  armAxisY,
  armPoints,
  armWidth,
  curlTurns,
  designReach,
  nebulaHeadroom,
  nebulaSquash,
  nebulaTop,
  ROW_HALF,
  veilAlpha,
} from './nebula-arms';

const cloud = RULE_ANIM.cloud;
const figure = cloud.figure;
const N = cloud.nebula;
const SHORT = Math.max(LOGICAL_SIZE.minHeight, Math.round((693 * LOGICAL_SIZE.width) / 390));
const TALL = Math.round((844 * LOGICAL_SIZE.width) / 390);
const PLATES_BOTTOM = Math.max(...HUD_LAYOUT.plates.map((p) => p.y + p.height));
const NEXT_PLATE = HUD_LAYOUT.plates[5];

/** Screen y of the top of the nebula on a screen `screenH` tall, at the highest bob and widest breath. */
function highestTop(screenH: number): number {
  const centre = flightRowY(screenH) - ANIM.flying.bobAmplitude - cloud.bobPx;
  return centre - nebulaTop(nebulaSquash(screenH)) * figure.scale * (1 + cloud.breathe);
}

describe('nebula arms', () => {
  it('cross once, in the middle, on the row centre, in antiphase', () => {
    expect(armAxisY('pink', 0)).toBeCloseTo(0);
    expect(armAxisY('blue', 0)).toBeCloseTo(0);
    const reach = Math.min(N.arms.pink.reach, N.arms.blue.reach);
    for (let u = -reach + 2; u < reach - 1; u += 2) {
      if (Math.abs(u) < 1) continue;
      const pink = armAxisY('pink', u);
      const blue = armAxisY('blue', u);
      // Where the pink arm is up the blue one is down: they never meet away from the middle.
      expect(Math.sign(pink)).toBe(-Math.sign(blue));
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

  it('curls the pink ends into spirals of one and a half turns and the blue ends into small hooks the other way', () => {
    const pink = armPoints('pink');
    const blue = armPoints('blue');
    const pinkTurns = curlTurns(pink.right, Math.atan2(pink.right[0]?.y ?? 0, 1));
    expect(Math.abs(pinkTurns)).toBeGreaterThan(1.4);
    expect(Math.abs(pinkTurns)).toBeLessThan(1.6);
    const hook = curlTurns(blue.right, Math.atan2(blue.right[0]?.y ?? 0, 1));
    expect(Math.abs(hook)).toBeLessThan(0.6);
    expect(Math.sign(hook)).toBe(-Math.sign(pinkTurns));
    // The spirals turn to the end tone.
    expect(pink.right[pink.right.length - 1]?.end).toBeCloseTo(1);
    // The spirals lie inside the screen with the figure at rest and drifted (visible half about 386 baked px).
    const half = LOGICAL_SIZE.width / 2 / figure.scale;
    const drift = (cloud.driftPx + cloud.swayPx) / figure.scale;
    for (const p of [...pink.right, ...pink.left]) expect(Math.abs(p.x)).toBeLessThan(half - drift);
  });

  it('mutes the layer the same everywhere along the row: the veil is opaque over the whole cover row', () => {
    for (const h of [SHORT, TALL, LOGICAL_SIZE.maxHeight]) {
      const v = nebulaSquash(h);
      for (let x = figure.body.left; x <= figure.body.right; x += 7) {
        for (let y = -ROW_HALF; y <= ROW_HALF; y += 5) {
          expect(veilAlpha(x - figure.width / 2, y, v)).toBe(1);
        }
      }
    }
    // The contrast of the layer under it is 1 - the density cap everywhere: about 0.32.
    expect(1 - N.maxDensity).toBeCloseTo(0.32);
    // Nothing of the veil at the picture edges.
    expect(veilAlpha(-figure.width / 2 + 2, 0, 1)).toBe(0);
    expect(veilAlpha(0, figure.height / 2 - 2, 1)).toBe(0);
  });

  it('keeps everything inside its frames with a 3 px margin', () => {
    expect(designReach()).toBeLessThanOrEqual(figure.height / 2 - 3);
    const all = [...Object.values(armPoints('pink')), ...Object.values(armPoints('blue'))].flat();
    for (const p of all) {
      expect(Math.abs(p.x) + N.arms.glow * p.w).toBeLessThanOrEqual(figure.width / 2 - 3);
    }
    expect(N.halo.rx).toBeLessThanOrEqual(figure.width / 2 - 3);
  });

  it('draws the full picture on a 390x844 screen, the HUD gap under the plates', () => {
    expect(nebulaSquash(TALL)).toBe(1);
    expect(highestTop(TALL)).toBeGreaterThanOrEqual(PLATES_BOTTOM + FLIGHT_CLEAR.hudGapPx);
  });

  it('squashes the drawing just enough on shorter screens, down to the cloud top on 390x693', () => {
    for (let h = SHORT; h <= LOGICAL_SIZE.maxHeight; h += 20) {
      const v = nebulaSquash(h);
      expect(nebulaTop(v)).toBeLessThanOrEqual(nebulaHeadroom(h) + 0.01);
      if (riseRoom(h) > 0) {
        expect(highestTop(h)).toBeGreaterThanOrEqual(PLATES_BOTTOM + FLIGHT_CLEAR.hudGapPx - 0.5);
      }
    }
    expect(nebulaSquash(SHORT)).toBeLessThan(0.6);
    // On 390x693 it reaches no higher than the cloud's flattened top: the accepted gap to the next plate.
    expect(NEXT_PLATE).toBeDefined();
    if (!NEXT_PLATE) return;
    const restTop = flightRowY(SHORT) - nebulaTop(nebulaSquash(SHORT)) * figure.scale;
    expect(restTop - (NEXT_PLATE.y + NEXT_PLATE.height)).toBeGreaterThanOrEqual(
      FLIGHT_CLEAR.hudGapPx,
    );
  });
});
