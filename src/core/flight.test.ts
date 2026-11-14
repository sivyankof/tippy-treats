import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { ZONE_RULES } from '../data/zones';
import { Flight, flyingSpeed, newFlyingLayer, roofFactor } from './flight';
import type { FlyingLayer, SimEvent } from './sim-types';
import type { CloudRoll, LayerRules } from './zones';

const STEP = BALANCE.sim.stepMs;
const { minCenterX, maxCenterX } = BALANCE.layer;
const TRACK = maxCenterX - minCenterX;
const SPEED = 600;

const rules = (overrides: Partial<LayerRules> = {}): LayerRules => ({
  index: 30,
  zoneIndex: 1,
  rule: 'none',
  fromLeft: true,
  rush: false,
  fakeoutX: null,
  ...overrides,
});

const layerOf = (r: LayerRules, speed = SPEED): FlyingLayer =>
  newFlyingLayer({ kind: 'plain' }, r, 400, speed);

const NO_CLOUD = (): CloudRoll | null => null;

/** Runs the flight for `ms` and returns what it reported. */
function fly(flight: Flight, ms: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let t = 0; t < ms - 1e-9; t += STEP) flight.step(STEP, events);
  return events;
}

describe('roofFactor and flyingSpeed', () => {
  it('is slow at the walls and fast in the middle, symmetric', () => {
    expect(roofFactor(minCenterX)).toBeCloseTo(ZONE_RULES.roof.edgeMult);
    expect(roofFactor(maxCenterX)).toBeCloseTo(ZONE_RULES.roof.edgeMult);
    expect(roofFactor((minCenterX + maxCenterX) / 2)).toBeCloseTo(ZONE_RULES.roof.centreMult);
    expect(roofFactor(minCenterX + 100)).toBeCloseTo(roofFactor(maxCenterX - 100));
    expect(roofFactor(minCenterX - 50)).toBeCloseTo(ZONE_RULES.roof.edgeMult);
  });

  it('is the nominal speed for a plain layer', () => {
    expect(flyingSpeed(layerOf(rules()))).toBe(SPEED);
  });

  it('follows the roof profile only under the roof rule', () => {
    const layer = layerOf(rules({ rule: 'roof' }));
    layer.x = 540;
    expect(flyingSpeed(layer)).toBeCloseTo(SPEED * ZONE_RULES.roof.centreMult);
    layer.x = minCenterX;
    expect(flyingSpeed(layer)).toBeCloseTo(SPEED * ZONE_RULES.roof.edgeMult);
  });

  it('flies a rush layer faster once the wind-up is over and holds still before', () => {
    const layer = layerOf(rules({ rule: 'showcase', rush: true }));
    expect(flyingSpeed(layer)).toBe(0);
    layer.windupMs = 0;
    expect(flyingSpeed(layer)).toBeCloseTo(SPEED * ZONE_RULES.rush.speedMult);
  });

  it('is zero during a fake-out stop', () => {
    const layer = layerOf(rules({ rule: 'stars' }));
    layer.stopMs = 100;
    expect(flyingSpeed(layer)).toBe(0);
  });
});

describe('newFlyingLayer', () => {
  it('starts at the wall of its side, heading inward, at the first pass', () => {
    expect(layerOf(rules({ fromLeft: true }))).toMatchObject({ x: minCenterX, dir: 1, pass: 1 });
    expect(layerOf(rules({ fromLeft: false }))).toMatchObject({ x: maxCenterX, dir: -1 });
  });

  it('carries the rule fields and the plan, and winds up only a rush layer', () => {
    const layer = newFlyingLayer(
      { kind: 'creature', creature: 'honey', level: 2 },
      rules({ index: 44, zoneIndex: 2, rule: 'roof' }),
      360,
      700,
    );
    expect(layer).toMatchObject({
      index: 44,
      zoneIndex: 2,
      rule: 'roof',
      rush: false,
      windupMs: 0,
      stopMs: 0,
      coverMs: 0,
      cloudAheadPx: -1,
      kind: 'creature',
      creature: 'honey',
      width: 360,
      speed: 700,
    });
    expect(layerOf(rules({ rule: 'showcase', rush: true })).windupMs).toBe(
      ZONE_RULES.rush.windupMs,
    );
  });
});

describe('Flight: walls and passes', () => {
  it('moves at the nominal speed and bounces off the walls, counting passes', () => {
    const layer = layerOf(rules());
    const flight = new Flight(layer, null, NO_CLOUD);
    fly(flight, 1000);
    expect(layer.x).toBeCloseTo(minCenterX + SPEED, 0);
    expect(layer.pass).toBe(1);
    fly(flight, 500);
    // 800 px to the wall takes 1333 ms; the rest of the 1500 ms comes back.
    expect(layer.dir).toBe(-1);
    expect(layer.pass).toBe(2);
    expect(layer.x).toBeCloseTo(maxCenterX - (SPEED * 1500) / 1000 + TRACK, 0);
    fly(flight, 1400);
    expect(layer.dir).toBe(1);
    expect(layer.pass).toBe(3);
    for (let i = 0; i < 2000; i++) {
      fly(flight, STEP);
      expect(layer.x).toBeGreaterThanOrEqual(minCenterX);
      expect(layer.x).toBeLessThanOrEqual(maxCenterX);
    }
  });

  it('starts from the right and reads the layer speed live', () => {
    const layer = layerOf(rules({ fromLeft: false }));
    const flight = new Flight(layer, null, NO_CLOUD);
    layer.speed = 120;
    fly(flight, 1000);
    expect(layer.x).toBeCloseTo(maxCenterX - 120, 0);
  });

  it('is slower near a wall than in the middle under the roof rule', () => {
    const layer = layerOf(rules({ rule: 'roof' }));
    const flight = new Flight(layer, null, NO_CLOUD);
    const dxAt = (x: number): number => {
      layer.x = x;
      layer.dir = 1;
      fly(flight, STEP);
      return layer.x - x;
    };
    expect(dxAt(minCenterX + 5)).toBeLessThan(dxAt(540));
    expect(dxAt(maxCenterX - 300)).toBeLessThan(dxAt(540));
  });
});

describe('Flight: rush', () => {
  it('holds still for the wind-up and then flies at 1.35 times the speed', () => {
    const layer = layerOf(rules({ rule: 'showcase', rush: true }));
    const flight = new Flight(layer, null, NO_CLOUD);
    fly(flight, ZONE_RULES.rush.windupMs - 2 * STEP);
    expect(layer.x).toBe(minCenterX);
    expect(layer.windupMs).toBeGreaterThan(0);
    fly(flight, 3 * STEP);
    expect(layer.windupMs).toBe(0);
    const before = layer.x;
    fly(flight, 500);
    expect(layer.x - before).toBeCloseTo((SPEED * ZONE_RULES.rush.speedMult * 500) / 1000, 0);
  });

  it('keeps the rush speed after a bounce', () => {
    const layer = layerOf(rules({ rule: 'showcase', rush: true }));
    const flight = new Flight(layer, null, NO_CLOUD);
    fly(flight, ZONE_RULES.rush.windupMs + 2000);
    expect(layer.pass).toBeGreaterThanOrEqual(2);
    expect(flyingSpeed(layer)).toBeCloseTo(SPEED * ZONE_RULES.rush.speedMult);
  });
});

describe('Flight: fake-out', () => {
  const FAKE_X = 600;

  it('stops for 150 ms at the point, reports it once, then reverses', () => {
    const layer = layerOf(rules({ rule: 'stars', zoneIndex: 4 }));
    const flight = new Flight(layer, FAKE_X, NO_CLOUD);
    const events = fly(flight, 2000);
    const fakeouts = events.filter((e) => e.type === 'fakeout');
    expect(fakeouts).toEqual([{ type: 'fakeout', x: FAKE_X, stopMs: ZONE_RULES.stars.stopMs }]);
  });

  it('does not move during the stop and heads back afterwards', () => {
    const layer = layerOf(rules({ rule: 'stars', zoneIndex: 4 }));
    const flight = new Flight(layer, FAKE_X, NO_CLOUD);
    const events: SimEvent[] = [];
    let guard = 0;
    while (layer.stopMs === 0 && guard++ < 1000) flight.step(STEP, events);
    expect(layer.x).toBe(FAKE_X);
    expect(layer.dir).toBe(1);
    const stopSteps = Math.ceil(ZONE_RULES.stars.stopMs / STEP);
    for (let i = 0; i < stopSteps - 1; i++) {
      flight.step(STEP, events);
      expect(layer.x).toBe(FAKE_X);
      expect(layer.stopMs).toBeGreaterThan(0);
    }
    flight.step(STEP, events);
    expect(layer.stopMs).toBe(0);
    expect(layer.dir).toBe(-1);
    fly(flight, 200);
    expect(layer.x).toBeLessThan(FAKE_X);
  });

  it('happens at most once in the life of the layer, however often it crosses the point', () => {
    const layer = layerOf(rules({ rule: 'stars', zoneIndex: 4 }));
    const flight = new Flight(layer, FAKE_X, NO_CLOUD);
    const events = fly(flight, 30_000);
    expect(events.filter((e) => e.type === 'fakeout')).toHaveLength(1);
  });

  it('triggers when a layer from the right first crosses the point, too', () => {
    const layer = layerOf(rules({ rule: 'stars', zoneIndex: 4, fromLeft: false }));
    const flight = new Flight(layer, 300, NO_CLOUD);
    const events = fly(flight, 2000);
    expect(events.filter((e) => e.type === 'fakeout')).toHaveLength(1);
    expect(layer.dir === 1 || layer.stopMs > 0 || layer.x > 300).toBe(true);
  });

  it('never triggers without a point', () => {
    const flight = new Flight(layerOf(rules({ rule: 'stars' })), null, NO_CLOUD);
    expect(fly(flight, 10_000).filter((e) => e.type === 'fakeout')).toHaveLength(0);
  });
});

describe('Flight: clouds', () => {
  const rolls: Record<number, CloudRoll | null> = {
    1: { coverMs: 400, startProgress: 0.3 },
    2: null,
    3: { coverMs: 300, startProgress: 0.2 },
  };
  const rollCloud = (pass: number): CloudRoll | null => rolls[pass] ?? null;

  it('covers the layer for the rolled time once the pass reaches the rolled point', () => {
    const layer = layerOf(rules({ rule: 'clouds', zoneIndex: 3 }));
    const flight = new Flight(layer, null, rollCloud);
    const events: SimEvent[] = [];
    // 30% of 800 px is 240 px: reached after 400 ms at 600 px/s.
    while (layer.x < minCenterX + 0.3 * TRACK - 5) flight.step(STEP, events);
    expect(layer.coverMs).toBe(0);
    expect(events).toHaveLength(0);
    while (layer.coverMs === 0) flight.step(STEP, events);
    expect(layer.x - minCenterX).toBeGreaterThanOrEqual(0.3 * TRACK);
    expect(events).toEqual([{ type: 'cloud', coverMs: 400, pass: 1 }]);
    expect(layer.coverMs).toBeCloseTo(400, 0);
    const left = layer.coverMs;
    flight.step(STEP, events);
    expect(layer.coverMs).toBeCloseTo(left - STEP);
    fly(flight, 450);
    expect(layer.coverMs).toBe(0);
  });

  it('tells how much track is left before the cloud of the pass comes', () => {
    const layer = layerOf(rules({ rule: 'clouds', zoneIndex: 3 }));
    const flight = new Flight(layer, null, rollCloud);
    expect(layer.cloudAheadPx).toBeCloseTo(0.3 * TRACK);
    const events: SimEvent[] = [];
    flight.step(STEP, events);
    expect(layer.cloudAheadPx).toBeCloseTo(0.3 * TRACK - (layer.x - minCenterX));
    while (layer.coverMs === 0) flight.step(STEP, events);
    // The cloud has come and pass 2 has none: nothing more is due until pass 3 is in sight.
    expect(layer.cloudAheadPx).toBe(-1);
    // Pass 2 flies back from the right wall; from then on the cloud of pass 3 is counted ahead.
    while (layer.pass < 2) flight.step(STEP, events);
    flight.step(STEP, events);
    const toWall = layer.x - minCenterX;
    expect(layer.cloudAheadPx).toBeCloseTo(toWall + 0.2 * TRACK);
    const none = layerOf(rules({ rule: 'clouds', zoneIndex: 3 }));
    new Flight(none, null, () => null);
    expect(none.cloudAheadPx).toBe(-1);
  });

  it('brings at most one cloud per pass and rolls again after every bounce', () => {
    const layer = layerOf(rules({ rule: 'clouds', zoneIndex: 3 }));
    const asked: number[] = [];
    const flight = new Flight(layer, null, (pass) => {
      asked.push(pass);
      return rollCloud(pass);
    });
    // Passes 1 and 3 have a cloud, pass 2 has none, pass 4 on has none.
    const events = fly(flight, 4 * (TRACK / SPEED) * 1000);
    const clouds = events.filter((e) => e.type === 'cloud');
    expect(clouds).toEqual([
      { type: 'cloud', coverMs: 400, pass: 1 },
      { type: 'cloud', coverMs: 300, pass: 3 },
    ]);
    expect(asked.slice(0, 4)).toEqual([1, 2, 3, 4]);
  });

  it('does not change the motion of the layer', () => {
    const plain = layerOf(rules());
    const clouded = layerOf(rules({ rule: 'clouds' }));
    const a = new Flight(plain, null, NO_CLOUD);
    const b = new Flight(clouded, null, rollCloud);
    for (let i = 0; i < 1500; i++) {
      fly(a, STEP);
      fly(b, STEP);
      expect(clouded.x).toBe(plain.x);
      expect(clouded.dir).toBe(plain.dir);
    }
  });

  it('extends the cover when the next cloud arrives before the last one is gone', () => {
    const layer = layerOf(rules({ rule: 'clouds' }), 1400);
    const flight = new Flight(layer, null, () => ({ coverMs: 500, startProgress: 0.15 }));
    // 1400 px/s: a pass takes 571 ms and the cloud arrives 86 ms into it.
    fly(flight, 700);
    expect(layer.coverMs).toBeGreaterThan(400);
    expect(layer.coverMs).toBeLessThanOrEqual(500);
  });
});
