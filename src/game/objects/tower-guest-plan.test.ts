import { describe, expect, it } from 'vitest';
import { Rng } from '../../core/rng';
import { TOWER_GUEST } from '../../data/tower-guest';
import { easeInQuad as easeIn, easeOutQuad as easeOut } from '../../util/math';
import {
  clearOfFace,
  flightPoint,
  flinchPose,
  GuestScheduler,
  layerCovers,
  layerOverGuest,
  shouldFlinch,
  siteOffset,
  splatShape,
  type FlightPoint,
  type GuestShape,
} from './tower-guest-plan';

const { site, splat } = TOWER_GUEST;
const HALF_BODY = 27;
const FACE = 40;

describe('GuestScheduler', () => {
  it('waits for the first visit, then a whole interval, drawn from the given stream', () => {
    const rng = new Rng(7);
    const scheduler = new GuestScheduler(() => rng.next());
    expect(scheduler.ready).toBe(false);
    scheduler.tick(TOWER_GUEST.firstDelayMs[1]);
    expect(scheduler.ready).toBe(true);
    scheduler.started();
    scheduler.tick(TOWER_GUEST.intervalMs[0] - 1);
    expect(scheduler.ready).toBe(false);
    scheduler.tick(TOWER_GUEST.intervalMs[1]);
    expect(scheduler.ready).toBe(true);
  });

  it('looks again soon when a visit could not start', () => {
    const scheduler = new GuestScheduler(() => 0);
    scheduler.tick(TOWER_GUEST.firstDelayMs[1]);
    scheduler.retry();
    expect(scheduler.ready).toBe(false);
    scheduler.tick(TOWER_GUEST.retryMs);
    expect(scheduler.ready).toBe(true);
  });

  it('is the same for the same seed and differs between seeds', () => {
    const waits = (seed: number): number[] => {
      const rng = new Rng(seed);
      const scheduler = new GuestScheduler(() => rng.next());
      const out: number[] = [];
      for (let i = 0; i < 4; i++) {
        let ms = 0;
        while (!scheduler.ready) {
          scheduler.tick(100);
          ms += 100;
        }
        out.push(ms);
        scheduler.started();
      }
      return out;
    };
    expect(waits(3)).toEqual(waits(3));
    expect(waits(3)).not.toEqual(waits(4));
  });
});

describe('siteOffset', () => {
  it('keeps the guest clear of the face and inside the layer for any side and reach', () => {
    for (const side of [-1, 1] as const) {
      for (const reach of [0, 0.3, 0.7, 1]) {
        const x = siteOffset(300, FACE, HALF_BODY, side, reach);
        expect(x).not.toBeNull();
        const abs = Math.abs(x ?? 0);
        expect(Math.sign(x ?? 0)).toBe(side);
        expect(abs - HALF_BODY).toBeGreaterThanOrEqual(FACE + site.faceGapPx - 1e-9);
        expect(abs + HALF_BODY).toBeLessThanOrEqual(150 - site.edgeGapPx + 1e-9);
      }
    }
  });

  it('finds no seat on a layer that is all face', () => {
    expect(siteOffset(160, FACE, HALF_BODY, 1, 0.5)).toBeNull();
  });

  it('keeps clear of the shadow, switching to the other side when needed', () => {
    const shadow = { left: 40, right: 200 };
    const x = siteOffset(400, FACE, HALF_BODY, 1, 0.5, shadow);
    expect(x).not.toBeNull();
    expect(x).toBeLessThan(0);
    const both = { left: -200, right: 200 };
    expect(siteOffset(400, FACE, HALF_BODY, 1, 0.5, both)).toBeNull();
  });
});

describe('layers over a guest', () => {
  it('a layer is over the guest within its half width plus the margin', () => {
    expect(layerOverGuest(100, 100, 200)).toBe(true);
    expect(layerOverGuest(100 + 100 + TOWER_GUEST.shy.marginPx - 1, 100, 200)).toBe(true);
    expect(layerOverGuest(100 + 100 + TOWER_GUEST.shy.marginPx + 1, 100, 200)).toBe(false);
  });

  it('a layer covers the guest only within its own width', () => {
    expect(layerCovers(150, 100, 200)).toBe(true);
    expect(layerCovers(201, 100, 200)).toBe(false);
  });
});

describe('shouldFlinch', () => {
  it('flinches when a layer comes near, not while it stays', () => {
    expect(shouldFlinch(true, false, 0)).toBe(true);
    expect(shouldFlinch(true, true, 0)).toBe(false);
    expect(shouldFlinch(false, true, 0)).toBe(false);
  });

  it('waits out the cooldown after the last flinch', () => {
    expect(shouldFlinch(true, false, 300)).toBe(false);
    expect(shouldFlinch(true, false, 0)).toBe(true);
  });
});

describe('flinchPose', () => {
  const out = { lift: 0, lean: 0 };

  it('starts and ends at rest and peaks in the middle', () => {
    flinchPose(0, 1, out);
    expect(out.lift).toBeCloseTo(0);
    flinchPose(TOWER_GUEST.shy.hopMs, 1, out);
    expect(out.lift).toBeCloseTo(0);
    flinchPose(TOWER_GUEST.shy.hopMs / 2, 1, out);
    expect(out.lift).toBeCloseTo(TOWER_GUEST.shy.hopPx);
  });

  it('leans away from the layer', () => {
    flinchPose(TOWER_GUEST.shy.hopMs / 2, 1, out);
    expect(out.lean).toBeGreaterThan(0);
    flinchPose(TOWER_GUEST.shy.hopMs / 2, -1, out);
    expect(out.lean).toBeLessThan(0);
  });
});

describe('clearOfFace', () => {
  const near = FACE + site.faceGapPx + HALF_BODY;

  it('pushes a guest under the face out to the face edge, on its own side', () => {
    expect(clearOfFace(5, FACE, HALF_BODY, 400)).toBeCloseTo(near);
    expect(clearOfFace(-5, FACE, HALF_BODY, 400)).toBeCloseTo(-near);
  });

  it('leaves a guest that is clear of the face where it is', () => {
    expect(clearOfFace(near + 20, FACE, HALF_BODY, 400)).toBeCloseTo(near + 20);
  });

  it('keeps the guest on the layer', () => {
    expect(clearOfFace(500, FACE, HALF_BODY, 300)).toBeLessThanOrEqual(150);
  });
});

describe('flightPoint', () => {
  const out: FlightPoint = { x: 0, y: 0 };

  it('starts and ends exactly at its ends', () => {
    flightPoint(10, 20, 300, -40, 0, 30, 3, easeOut, out);
    expect(out).toEqual({ x: 10, y: 20 });
    flightPoint(10, 20, 300, -40, 1, 30, 3, easeOut, out);
    expect(out.x).toBeCloseTo(300);
    expect(out.y).toBeCloseTo(-40);
  });

  it('zigzags to both sides of the straight way but never further than its amplitude', () => {
    let min = 0;
    let max = 0;
    for (let i = 0; i <= 100; i++) {
      flightPoint(0, 0, 400, 0, i / 100, 30, 3, (t) => t, out);
      min = Math.min(min, out.y);
      max = Math.max(max, out.y);
    }
    expect(min).toBeLessThan(-10);
    expect(max).toBeGreaterThan(10);
    expect(Math.max(-min, max)).toBeLessThanOrEqual(30 + 1e-9);
  });

  it('eases in slowly and out slowly', () => {
    expect(easeIn(0.5)).toBeLessThan(0.5);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });
});

describe('splatShape', () => {
  const shape: GuestShape = { flat: false, scaleX: 1, scaleY: 1, tilt: 0 };

  it('squashes the normal picture down and wide', () => {
    splatShape('squash', 0, shape);
    expect([shape.flat, shape.scaleX, shape.scaleY]).toEqual([false, 1, 1]);
    splatShape('squash', splat.squashMs, shape);
    expect(shape.scaleX).toBeCloseTo(splat.squashTo.scaleX);
    expect(shape.scaleY).toBeCloseTo(splat.squashTo.scaleY);
  });

  it('shows the flat picture while held and begins the peel with it', () => {
    expect(splatShape('hold', 400, shape).flat).toBe(true);
    expect(splatShape('peel', 0, shape).flat).toBe(true);
    expect(splatShape('peel', splat.peelMs, shape).flat).toBe(false);
  });

  it('settles the gloop around the flat shape', () => {
    splatShape('hold', 5000, shape);
    expect(Math.abs(shape.scaleX - 1)).toBeLessThanOrEqual(splat.gloop.amount + 1e-9);
  });

  it('is continuous from the peel into the shake, and the shake ends in the normal shape', () => {
    splatShape('peel', splat.peelMs, shape);
    const peeled = { x: shape.scaleX, y: shape.scaleY };
    splatShape('shake', 0, shape);
    expect(shape.scaleX).toBeCloseTo(peeled.x);
    expect(shape.scaleY).toBeCloseTo(peeled.y);
    splatShape('shake', splat.shakeMs, shape);
    expect(shape.flat).toBe(false);
    expect(shape.scaleX).toBeCloseTo(1);
    expect(shape.scaleY).toBeCloseTo(1);
    expect(shape.tilt).toBeCloseTo(0);
  });
});
