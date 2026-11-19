import { describe, expect, it } from 'vitest';
import { BACKDROP } from '../../../../data/backdrop/backdrop';
import { PLANET_PLACE } from '../../../../data/zones/space-planets';
import { BACKDROP_LIFE, type HoverSpec } from '../../../../data/backdrop/backdrop-life';
import { ZONES } from '../../../../data/zones/zones';
import { flightClearBand } from '../../../camera-layout';
import {
  blinkFactor,
  clearBandPath,
  hoverPose,
  newPose,
  puffPose,
  travelPose,
  twinkleLevel,
  twinklePose,
  type Pose,
  type TravelPass,
} from './life-motion';

const W = 1080;
const H = 1920;
const NO_PASS: TravelPass = { shiftX: 0, shiftY: 0, direction: 1 };

function copy(pose: Pose): Pose {
  return { ...pose };
}

function differ(a: Pose, b: Pose): boolean {
  return (
    Math.abs(a.x - b.x) > 0.01 ||
    Math.abs(a.y - b.y) > 0.01 ||
    Math.abs(a.rotation - b.rotation) > 1e-4 ||
    Math.abs(a.scaleX - b.scaleX) > 1e-4 ||
    Math.abs(a.scaleY - b.scaleY) > 1e-4 ||
    Math.abs(a.alpha - b.alpha) > 1e-3 ||
    a.tint !== b.tint
  );
}

/** True when `sample` shows a different pose at some moment of every 2 s window. */
function neverStandsStill(sample: (timeMs: number) => Pose): boolean {
  for (let start = 0; start < 20000; start += 500) {
    const first = copy(sample(start));
    let moved = false;
    for (let dt = 100; dt <= 2000 && !moved; dt += 100) moved = differ(first, sample(start + dt));
    if (!moved) return false;
  }
  return true;
}

function allHovers(): HoverSpec[] {
  const life = BACKDROP_LIFE;
  return [
    life.kitchen.pot,
    life.kitchen.lid,
    life.kitchen.rail,
    ...life.kitchen.ladles,
    life.kitchen.clock,
    life.kitchen.clockHand,
    life.kitchen.pendulum,
    life.showcase.garland.wire,
    life.showcase.cakeStand,
    life.showcase.cake,
    ...life.showcase.sprinkles,
    life.roof.chimney,
    life.roof.rope,
    ...life.roof.laundry,
    life.stars.glow,
    life.stars.moon,
    ...life.stars.eyes,
  ];
}

describe('hoverPose', () => {
  it('places a picture at its share of the screen plus the offset', () => {
    const pose = hoverPose(
      { texture: 't', at: { x: 0.5, y: 0.25 }, offset: { x: 10, y: -4 } },
      W,
      H,
      0,
      newPose(),
    );
    expect(pose.x).toBe(550);
    expect(pose.y).toBe(476);
    expect(pose.scaleX).toBe(1);
    expect(pose.alpha).toBe(1);
  });

  it('swings by its amplitude and no more', () => {
    const spec: HoverSpec = { texture: 't', at: { x: 0, y: 0 }, swing: { deg: 10, ms: 1000 } };
    const peak = hoverPose(spec, W, H, 250, newPose()).rotation;
    expect(peak).toBeCloseTo((10 * Math.PI) / 180, 6);
    expect(hoverPose(spec, W, H, 750, newPose()).rotation).toBeCloseTo(-peak, 6);
  });

  it('spins continuously', () => {
    const spec: HoverSpec = { texture: 't', at: { x: 0, y: 0 }, spin: 90 };
    expect(hoverPose(spec, W, H, 1000, newPose()).rotation).toBeCloseTo(Math.PI / 2, 6);
  });

  it('keeps an orbiting picture on its ellipse and makes the near side bigger', () => {
    const spec: HoverSpec = {
      texture: 't',
      at: { x: 0.5, y: 0.5 },
      orbit: { rx: 60, ry: 10, degPerSec: 90, depth: 0.3 },
    };
    const right = hoverPose(spec, W, H, 0, newPose());
    expect(right.x).toBeCloseTo(600, 6);
    const near = hoverPose(spec, W, H, 1000, newPose());
    expect(near.y).toBeCloseTo(970, 6);
    expect(near.scaleX).toBeCloseTo(1.3, 6);
  });

  it('shifts neighbours by their phase so they do not move in sync', () => {
    const base: HoverSpec = { texture: 't', at: { x: 0, y: 0 }, bob: { px: 10, ms: 1000 } };
    const a = hoverPose(base, W, H, 100, newPose()).y;
    const b = hoverPose({ ...base, phase: 2 }, W, H, 100, newPose()).y;
    expect(a).not.toBeCloseTo(b, 3);
  });

  it('blends a tint cycle between its two colours', () => {
    const spec: HoverSpec = {
      texture: 't',
      at: { x: 0, y: 0 },
      tint: 0x000000,
      tintCycle: { to: 0xffffff, ms: 1000 },
    };
    expect(hoverPose(spec, W, H, 250, newPose()).tint).toBe(0xffffff);
    expect(hoverPose(spec, W, H, 750, newPose()).tint).toBe(0x000000);
  });
});

describe('blinkFactor', () => {
  const blink = { ms: 1000, share: 0.1, min: 0.2 };

  it('is open for most of the period and shut at the middle of the blink', () => {
    expect(blinkFactor(0, blink)).toBe(1);
    expect(blinkFactor(850, blink)).toBe(1);
    expect(blinkFactor(950, blink)).toBeCloseTo(0.2, 6);
    expect(blinkFactor(999, blink)).toBeGreaterThan(0.9);
  });
});

describe('no still object (docs/06, section 10)', () => {
  it('every hovering picture of every zone changes at least once in any 2 seconds', () => {
    for (const spec of allHovers()) {
      const pose = newPose();
      const sample = (t: number): Pose => hoverPose(spec, W, H, t, pose);
      expect(neverStandsStill(sample), spec.texture).toBe(true);
    }
  });

  it('rising puffs and twinkling points keep changing', () => {
    for (const spec of [BACKDROP_LIFE.kitchen.steam, BACKDROP_LIFE.roof.smoke]) {
      for (let i = 0; i < spec.count; i++) {
        const pose = newPose();
        expect(neverStandsStill((t) => puffPose(spec, i, t, 0, 0, pose))).toBe(true);
      }
    }
    for (const spec of [BACKDROP_LIFE.stars.twinkle, BACKDROP_LIFE.showcase.garland.bulbs]) {
      for (let i = 0; i < spec.points.length; i++) {
        const pose = newPose();
        const at = { x: 0, y: 0 };
        expect(neverStandsStill((t) => twinklePose(spec, i, t, at, pose))).toBe(true);
      }
    }
  });

  it('every zone has parallax layers that drift on their own', () => {
    for (const zone of ZONES) {
      const drift = BACKDROP.drift[zone.id];
      expect(drift).toHaveLength(4);
      for (const speed of drift) expect(Math.abs(speed)).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('travelPose', () => {
  const spec = BACKDROP_LIFE.stars.shooting;

  it('runs from the start of the path to its end', () => {
    const start = travelPose(spec, NO_PASS, 0, 0, W, H, 0, newPose());
    const end = travelPose(spec, NO_PASS, 0, 1, W, H, 0, newPose());
    expect(start.x).toBeCloseTo(spec.from.x * W, 6);
    expect(end.y).toBeCloseTo(spec.to.y * H, 6);
  });

  it('points along its path and fades at both ends', () => {
    const start = travelPose(spec, NO_PASS, 0, 0, W, H, 0, newPose());
    const mid = travelPose(spec, NO_PASS, 0, 0.5, W, H, 0, newPose());
    const expected = Math.atan2((spec.to.y - spec.from.y) * H, (spec.to.x - spec.from.x) * W);
    expect(mid.rotation).toBeCloseTo(expected, 6);
    expect(start.alpha).toBe(0);
    expect(mid.alpha).toBe(1);
  });

  it('mirrors a picture that flies the other way', () => {
    const fly = BACKDROP_LIFE.kitchen.fly;
    const right = travelPose(fly, NO_PASS, 0, 0.5, W, H, 0, newPose());
    const left = travelPose(
      fly,
      { shiftX: 0, shiftY: 0, direction: -1 },
      0,
      0.5,
      W,
      H,
      0,
      newPose(),
    );
    expect(right.scaleX).toBeGreaterThan(0);
    expect(left.scaleX).toBeLessThan(0);
  });

  it('fans the members of a flock out behind the leader', () => {
    const birds = BACKDROP_LIFE.roof.birds;
    const lead = travelPose(birds, NO_PASS, 0, 0.5, W, H, 0, newPose());
    const second = travelPose(birds, NO_PASS, 1, 0.5, W, H, 0, newPose());
    expect(second.x).toBeLessThan(lead.x);
  });
});

describe('twinkleLevel', () => {
  it('stays between 0 and 1 and gives neighbours different levels', () => {
    const spec = BACKDROP_LIFE.stars.twinkle;
    const levels = spec.points.map((_, i) => twinkleLevel(spec, i, 1234));
    for (const level of levels) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    }
    expect(new Set(levels.map((l) => l.toFixed(3))).size).toBeGreaterThan(spec.points.length / 2);
  });

  it('alternates bulbs of a garland', () => {
    const spec = BACKDROP_LIFE.showcase.garland.bulbs;
    expect(twinkleLevel(spec, 0, 350)).not.toBeCloseTo(twinkleLevel(spec, 1, 350), 2);
    expect(twinkleLevel(spec, 0, 350)).toBeCloseTo(twinkleLevel(spec, 2, 350), 6);
  });
});

describe('background life of the zones (docs/06, section 5)', () => {
  it('has at least three kinds of moving elements in every zone', () => {
    const life = BACKDROP_LIFE;
    const kinds: Record<string, unknown[]> = {
      kitchen: [life.kitchen.steam, life.kitchen.ladles, life.kitchen.pendulum, life.kitchen.fly],
      showcase: [life.showcase.garland.bulbs, life.showcase.walkers, life.showcase.sprinkles],
      roof: [life.roof.birds, life.roof.smoke, life.roof.laundry],
      clouds: [BACKDROP.drift.clouds, life.clouds.balloon, life.clouds.plane],
      stars: [life.stars.twinkle, life.stars.shooting, life.stars.moon],
      space: [PLANET_PLACE.drift, life.space.satellite, life.space.comet, BACKDROP.layerTint.space],
    };
    for (const zone of ZONES) expect(kinds[zone.id]?.length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(kinds)).toHaveLength(ZONES.length);
  });
});

describe('clearBandPath with a HUD ceiling', () => {
  const band = { top: 800, bottom: 1300, ceiling: 500 };

  it('presses a path above the band down under the ceiling, bob and wobble included', () => {
    expect(clearBandPath(300, 700, 50, band, 2300, 10)).toEqual([560, 700]);
    expect(clearBandPath(400, 450, 50, band, 2300, 0)).toEqual([550, 550]);
  });

  it('keeps a path clear of both alone', () => {
    expect(clearBandPath(600, 700, 50, band, 2300, 10)).toEqual([600, 700]);
    expect(clearBandPath(1400, 1500, 50, band, 2300)).toEqual([1400, 1500]);
  });

  it('goes below the band when there is no room between the ceiling and the band', () => {
    const tight = { top: 600, bottom: 900, ceiling: 520 };
    expect(clearBandPath(500, 700, 50, tight, 2300, 10)).toEqual([960, 960]);
  });

  it('widens the band by the bob and wobble margin too', () => {
    expect(clearBandPath(700, 760, 50, band, 2300, 20)).toEqual([700, 730]);
    expect(clearBandPath(1340, 1400, 50, band, 2300, 20)).toEqual([1370, 1400]);
  });
});

describe('clearBandPath', () => {
  const band = { top: 800, bottom: 1000 };

  it('leaves a path that is already clear on one side alone', () => {
    expect(clearBandPath(100, 600, 50, band, 2300)).toEqual([100, 600]);
    expect(clearBandPath(1200, 1500, 50, band, 2300)).toEqual([1200, 1500]);
  });

  it('presses a path that would cross the band against the near edge, above or below', () => {
    expect(clearBandPath(500, 1100, 50, band, 2300)).toEqual([500, 750]);
    expect(clearBandPath(1400, 900, 50, band, 2300)).toEqual([1400, 1050]);
  });

  it('goes below when there is no room above', () => {
    expect(clearBandPath(60, 900, 50, { top: 90, bottom: 300 }, 2300)).toEqual([350, 900]);
  });
});

describe('travelPose in Space', () => {
  const { satellite, comet } = BACKDROP_LIFE.space;
  const screenW = 1080;

  it('keeps the satellite and the comet out of the stripe on every screen height and path shift', () => {
    for (const screenH of [1919, 2337, 2520]) {
      const clear = flightClearBand(screenH);
      for (const spec of [satellite, comet]) {
        const half = spec.avoidFlight?.halfPx ?? 0;
        for (const shiftY of [-0.1, 0, 0.1]) {
          for (let p = 0; p <= 1; p += 0.05) {
            const pass = { shiftX: 0, shiftY, direction: 1 as const };
            const pose = travelPose(spec, pass, 0, p, screenW, screenH, 0, newPose(), clear);
            const crosses = pose.y + half > clear.top && pose.y - half < clear.bottom;
            expect(crosses).toBe(false);
          }
        }
      }
    }
  });

  it('is unchanged without a clear stripe', () => {
    const pass = { shiftX: 0, shiftY: 0, direction: 1 as const };
    const free = travelPose(satellite, pass, 0, 0.5, screenW, 2337, 0, newPose());
    expect(free.y).toBeCloseTo(((satellite.from.y + satellite.to.y) / 2) * 2337);
  });
});
