import { describe, expect, it } from 'vitest';
import { MASTERY_FRAME } from '../../../data/creatures/mastery-look';
import { MENU } from '../../../data/common/menu-layout';
import {
  COLLECTION_BODY,
  crownSpot,
  framePerimeterPoint,
  isCollectionBody,
  masteryFramePad,
  outerRimReach,
  sparkleStartX,
} from './mastery-frame-geometry';

const WINDOW_BODY = { width: 600, height: 400 };

describe('mastery frame geometry', () => {
  it('knows the collection card from other plates', () => {
    expect(isCollectionBody(COLLECTION_BODY)).toBe(true);
    expect(isCollectionBody(WINDOW_BODY)).toBe(false);
  });

  it('keeps every crown fully inside the baked picture', () => {
    const pad = masteryFramePad();
    for (const body of [COLLECTION_BODY, WINDOW_BODY]) {
      const { cx, cy, r } = crownSpot(body);
      expect(pad + cy - r - MASTERY_FRAME.crown.outline).toBeGreaterThanOrEqual(0);
      expect(pad + cx - r).toBeGreaterThanOrEqual(0);
    }
  });

  it('fits the card frame into the collection grid gap', () => {
    const { gapX, gapY } = MENU.collection.card;
    expect(outerRimReach()).toBeLessThanOrEqual(Math.min(gapX, gapY) / 2);
    const { cy, r } = crownSpot(COLLECTION_BODY);
    // The crown top stays below the card above.
    expect(r - cy + MASTERY_FRAME.crown.outline).toBeLessThanOrEqual(gapY);
  });
});

describe('frame perimeter', () => {
  const inset = MASTERY_FRAME.outline + MASTERY_FRAME.band / 2;
  const bodies = [COLLECTION_BODY, WINDOW_BODY];
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number =>
    Math.hypot(a.x - b.x, a.y - b.y);

  /** Distance of a point from the centre line of the band (a rounded rectangle). */
  const offBand = (body: { width: number; height: number }, x: number, y: number): number => {
    const hw = body.width / 2 - inset;
    const hh = body.height / 2 - inset;
    const r = Math.max(0, MASTERY_FRAME.radius - inset);
    const qx = Math.abs(x) - (hw - r);
    const qy = Math.abs(y) - (hh - r);
    const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
    return Math.abs(outside + Math.min(Math.max(qx, qy), 0) - r);
  };

  it('is one closed loop: 0 and 1 are the same point', () => {
    for (const body of bodies) {
      const start = sparkleStartX(body);
      const a = framePerimeterPoint(body, 0, start);
      const b = framePerimeterPoint(body, 1, start);
      expect(dist(a, b)).toBeLessThan(1e-6);
      expect(a.y).toBeCloseTo(-(body.height / 2 - inset), 6);
      expect(a.x).toBeCloseTo(start, 6);
    }
  });

  it('stays on the band centre line, round corners included', () => {
    for (const body of bodies) {
      for (let i = 0; i <= 400; i++) {
        const p = framePerimeterPoint(body, i / 400, sparkleStartX(body));
        expect(offBand(body, p.x, p.y)).toBeLessThan(1e-6);
      }
    }
  });

  it('moves at one speed along edges and corners and has no jump', () => {
    for (const body of bodies) {
      const n = 4000;
      const steps: number[] = [];
      let prev = framePerimeterPoint(body, 0, 0);
      for (let i = 1; i <= n; i++) {
        const p = framePerimeterPoint(body, i / n, 0);
        steps.push(dist(prev, p));
        prev = p;
      }
      expect(Math.max(...steps) / Math.min(...steps)).toBeLessThan(1.01);
    }
  });

  it('runs clockwise: the right edge comes before the bottom', () => {
    expect(framePerimeterPoint(COLLECTION_BODY, 0.2, 0).x).toBeGreaterThan(0);
    expect(framePerimeterPoint(COLLECTION_BODY, 0.5, 0).y).toBeGreaterThan(0);
  });

  it('starts under the crown', () => {
    expect(sparkleStartX(COLLECTION_BODY)).toBe(0);
    expect(sparkleStartX(WINDOW_BODY)).toBeCloseTo(
      crownSpot(WINDOW_BODY).cx - WINDOW_BODY.width / 2,
      6,
    );
  });
});
