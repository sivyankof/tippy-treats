import { describe, expect, it } from 'vitest';
import { Rng } from '../../../core/rng';
import { BALANCE } from '../../../data/balance';
import { EFFECT_LEVELS } from '../../../data/effect-levels';
import { LOGICAL_SIZE } from '../../../data/screen';
import { STREET_WEATHER, streetFallView } from '../../../data/street-weather';
import { WEATHER_LOOK } from '../../../data/weather-look';
import { GLASS_WEATHER } from '../../../data/window-look';
import { clamp01 } from '../../../util/math';
import { flightClearBand, hudFloor } from '../../camera-layout';
import { laneCount, snowSpots, startU } from './weather-lanes';
import { fallShown, particleFade, rainSpots, rainX, rainY } from './weather-motion';

const KINDS = ['rain', 'storm', 'snow', 'leaves'] as const;
const view = streetFallView;

/** The logical height of a 390 px wide screen `css` px tall. */
const heightOf = (css: number): number =>
  Math.max(
    LOGICAL_SIZE.minHeight,
    Math.min(LOGICAL_SIZE.maxHeight, (LOGICAL_SIZE.width * css) / 390),
  );

describe('street weather of the Showcase', () => {
  it('keeps the street and the glass within the particle limit of every effects level', () => {
    for (const kind of KINDS) {
      const glass = GLASS_WEATHER[kind]?.showcase ?? 0;
      for (const level of EFFECT_LEVELS) {
        const street = fallShown(STREET_WEATHER.count[kind], level, true, view(kind));
        // Glass items stay on lite (still) and leave on minimal.
        const onGlass = level === 'minimal' ? 0 : glass;
        expect(street + onGlass, `${kind} on ${level}`).toBeLessThanOrEqual(
          WEATHER_LOOK.particleCount[level],
        );
      }
      expect(fallShown(STREET_WEATHER.count[kind], 'minimal', true, view(kind))).toBe(0);
      expect(fallShown(STREET_WEATHER.count[kind], 'lite', true, view(kind))).toBe(
        Math.round(STREET_WEATHER.count[kind] / 2),
      );
    }
  });

  it('mutes the street more than the Roof', () => {
    for (const kind of KINDS) {
      expect(view(kind).alpha, kind).toBeLessThan(1);
      expect(view(kind).scale, kind).toBeLessThan(1);
    }
    expect(STREET_WEATHER.bank.alpha).toBeLessThan(1);
    expect(STREET_WEATHER.bank.scaleY).toBeLessThan(WEATHER_LOOK.bank.scale);
  });

  it('keeps the white flakes plainer than the rest of the street, which stays at the shared share', () => {
    expect(view('snow').alpha).toBeGreaterThan(STREET_WEATHER.alpha);
    expect(view('snow').scale).toBeGreaterThan(STREET_WEATHER.scale);
    for (const kind of ['rain', 'storm', 'leaves'] as const) {
      expect(view(kind)).toEqual({
        count: STREET_WEATHER.count[kind],
        alpha: STREET_WEATHER.alpha,
        scale: STREET_WEATHER.scale,
      });
    }
  });

  it('throws the flash light wider than the lit patch of the cloud and keeps it soft', () => {
    const glow = STREET_WEATHER.glow;
    const patch = 2 * WEATHER_LOOK.bank.flashRadiusPx * STREET_WEATHER.bank.scaleX;
    expect(glow.widthPx).toBeGreaterThan(patch);
    expect(glow.heightPx).toBeGreaterThan(patch);
    // A light behind the glass: it brightens the street, it never whites it out.
    expect(glow.alpha).toBeGreaterThan(0);
    expect(glow.alpha).toBeLessThanOrEqual(0.5);
    // It reaches down past the HUD plates on the shortest screen, so the flash reads under them.
    expect(glow.centreY + glow.heightPx / 2).toBeGreaterThan(hudFloor() + glow.heightPx / 4);
  });

  it('keeps the smaller bank wider than the screen through its drift', () => {
    const shown = WEATHER_LOOK.bank.width * STREET_WEATHER.bank.scaleX;
    expect((shown - LOGICAL_SIZE.width) / 2).toBeGreaterThanOrEqual(STREET_WEATHER.bank.driftPx);
  });

  it('spawns the street rain over the whole width, evenly down the screen', () => {
    for (const kind of ['rain', 'storm'] as const) {
      const count = STREET_WEATHER.count[kind];
      for (let seed = 1; seed <= 10; seed++) {
        const rng = new Rng(seed);
        const spots = rainSpots(count, () => rng.next());
        const tenths = new Set(spots.map((p) => Math.floor(p.u * 10)));
        expect(tenths.size, `${kind} seed ${seed}`).toBeGreaterThanOrEqual(8);
        const rows = new Set(spots.map((p) => Math.floor(p.v * 5)));
        expect(rows.size).toBe(5);
      }
    }
  });

  it('spawns most of the street snow beside the tower and the rest behind it, within the lane cap', () => {
    const snow = WEATHER_LOOK.snow;
    const lanes = laneCount(LOGICAL_SIZE.width, snow.laneGapPx);
    const count = STREET_WEATHER.count.snow;
    expect(lanes * snow.laneCap).toBeGreaterThanOrEqual(count);
    const thirds = [0, 0, 0];
    for (let seed = 1; seed <= 20; seed++) {
      const rng = new Rng(seed);
      const spots = snowSpots(
        count,
        lanes,
        () => startU(rng, snow.sideBias, snow.sideShare),
        () => rng.next(),
      );
      for (const s of spots) thirds[Math.min(2, Math.floor(s.u * 3))]! += 1;
    }
    const [left = 0, middle = 0, right = 0] = thirds.map((n) => n / (count * 20));
    expect(left).toBeGreaterThan(0.3);
    expect(right).toBeGreaterThan(0.3);
    expect(middle).toBeGreaterThan(0.05);
  });

  it('keeps some street raindrops visible beside the tower on both screen heights', () => {
    const { width } = LOGICAL_SIZE;
    const towerLeft = (width - BALANCE.tray.width) / 2;
    const towerRight = width - towerLeft;
    for (const kind of ['rain', 'storm'] as const) {
      const look = WEATHER_LOOK[kind];
      const count = STREET_WEATHER.count[kind];
      const shown = fallShown(count, 'full', true, view(kind));
      for (const [css, least] of [
        [844, 2],
        [693, 1],
      ] as const) {
        const height = heightOf(css);
        const band = flightClearBand(height);
        const top = hudFloor();
        const pad = WEATHER_LOOK.endFeatherPx;
        let sum = 0;
        let frames = 0;
        let lowest = Infinity;
        for (let seed = 1; seed <= 8; seed++) {
          const rng = new Rng(seed);
          const spots = rainSpots(count, () => rng.next());
          const speed = rng.range(look.speed[0], look.speed[1]);
          for (let t = 0; t < 30; t += 0.1) {
            let outside = 0;
            for (let i = 0; i < shown; i++) {
              const p = spots[i];
              if (!p) continue;
              const y = rainY(p.v, speed, t, top, height, 0, band);
              const x = rainX(p.u, look.slant, y, top, width, WEATHER_LOOK.rainWrapMarginPx);
              const alpha =
                clamp01((y - top) / pad) *
                particleFade(y, band, WEATHER_LOOK.bandFeatherPx, height, pad);
              if (alpha > 0.4 && (x <= towerLeft || x >= towerRight)) outside++;
            }
            lowest = Math.min(lowest, outside);
            sum += outside;
            frames++;
          }
        }
        expect(lowest, `${kind} on ${css}`).toBeGreaterThanOrEqual(least);
        expect(sum / frames).toBeGreaterThan(least + 1);
      }
    }
  });
});
