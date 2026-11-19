import { describe, expect, it } from 'vitest';
import { Rng } from '../../../core/rng';
import { BALANCE } from '../../../data/tower/balance';
import { EFFECT_LEVELS } from '../../../data/app/effect-levels';
import { FLIGHT_CLEAR } from '../../../data/backdrop/flight-clear';
import { HUD_LAYOUT } from '../../../data/run/hud-layout';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { STREET_WEATHER, streetFallView } from '../../../data/weather/street-weather';
import { WEATHER_LOOK } from '../../../data/weather/weather-look';
import { GLASS_WEATHER } from '../../../data/weather/window-look';
import { TWO_PI } from '../../../util/math';
import { flightClearBand, hudFloor } from '../../camera-layout';
import { laneCount, snowSpots, startU } from './weather-lanes';
import { onScreen } from './weather-test-view';
import {
  bankEdge,
  fallShown,
  flightRowShade,
  rainSpots,
  rainX,
  rainY,
  sideWarp,
  wrapRange,
} from './weather-motion';

const KINDS = ['rain', 'storm', 'snow', 'leaves'] as const;
const view = streetFallView;

/** The logical height of a 390 px wide screen `css` px tall. */
const heightOf = (css: number): number =>
  Math.max(
    LOGICAL_SIZE.minHeight,
    Math.min(LOGICAL_SIZE.maxHeight, (LOGICAL_SIZE.width * css) / 390),
  );

const towerLeft = (LOGICAL_SIZE.width - BALANCE.tray.width) / 2;
const towerRight = LOGICAL_SIZE.width - towerLeft;
/** The lowest screen y of the awning's scallops when it hangs at the top of the screen. */
const AWNING_BOTTOM_PX = 236;

describe('street weather of the Showcase', () => {
  it('fills what the glass leaves of the particle limit of every effects level', () => {
    for (const kind of KINDS) {
      const glass = GLASS_WEATHER[kind]?.showcase ?? 0;
      const pool = STREET_WEATHER.count[kind];
      for (const level of EFFECT_LEVELS) {
        const street = fallShown(pool, level, true, view(kind));
        // Glass items stay on lite (still) and leave on minimal.
        const onGlass = level === 'minimal' ? 0 : glass;
        expect(street + onGlass, `${kind} on ${level}`).toBeLessThanOrEqual(
          WEATHER_LOOK.particleCount[level],
        );
      }
      expect(pool + glass).toBe(WEATHER_LOOK.particleCount.full);
      expect(fallShown(pool, 'lite', true, view(kind))).toBe(
        WEATHER_LOOK.particleCount.lite - glass,
      );
      expect(fallShown(pool, 'minimal', true, view(kind))).toBe(0);
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

  it('shows the street drops and flakes paler than the Roof but plainer than the first street look', () => {
    for (const kind of ['rain', 'storm'] as const) {
      expect(view(kind).alpha).toBeGreaterThanOrEqual(0.7);
    }
    expect(view('snow').alpha).toBeGreaterThan(STREET_WEATHER.alpha);
    expect(view('snow').scale).toBeGreaterThan(STREET_WEATHER.scale);
    for (const kind of ['rain', 'storm', 'leaves'] as const) {
      expect(view(kind)).toMatchObject({
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

  it('warps the even spread of the rain so that the wanted share falls beside the tower', () => {
    const strip = 1 - BALANCE.tray.width / LOGICAL_SIZE.width;
    const share = STREET_WEATHER.outsideShare;
    const n = 1000;
    const us = Array.from({ length: n }, (_, i) => sideWarp((i + 0.5) / n, share, strip));
    expect(Math.min(...us)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...us)).toBeLessThanOrEqual(1);
    const outside = us.filter((u) => u < strip / 2 || u > 1 - strip / 2).length / n;
    expect(outside).toBeCloseTo(share, 2);
  });

  it('spawns the street rain over the whole width, evenly down the screen', () => {
    for (const kind of ['rain', 'storm'] as const) {
      const count = STREET_WEATHER.count[kind];
      const out = view(kind).outside;
      for (let seed = 1; seed <= 10; seed++) {
        const rng = new Rng(seed);
        const spots = rainSpots(count, () => rng.next());
        const us = spots.map((p) => sideWarp(p.u, out?.share ?? 0, out?.stripShare ?? 0));
        // Some drops over the tower too: above its top the whole street shows.
        expect(us.filter((u) => u > 0.25 && u < 0.75).length, `${kind} ${seed}`).toBeGreaterThan(5);
        const rows = new Set(spots.map((p) => Math.floor(p.v * 5)));
        expect(rows.size).toBe(5);
      }
    }
  });

  it('spawns most of the street snow beside the tower, within the lane cap', () => {
    const snow = WEATHER_LOOK.snow;
    const v = view('snow');
    const lanes = laneCount(LOGICAL_SIZE.width, snow.laneGapPx);
    const count = STREET_WEATHER.count.snow;
    expect(lanes * snow.laneCap).toBeGreaterThanOrEqual(count);
    let outside = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const rng = new Rng(seed);
      const spots = snowSpots(
        count,
        lanes,
        () => startU(rng, v.sides?.bias ?? snow.sideBias, v.sides?.share ?? snow.sideShare),
        () => rng.next(),
      );
      for (const s of spots) {
        const x = s.u * LOGICAL_SIZE.width;
        if (x < towerLeft + 40 || x > towerRight - 40) outside++;
      }
    }
    expect(outside / (count * 20)).toBeGreaterThan(0.5);
  });

  it('shows enough drops outside the tower at the worst moment, on both screen heights', () => {
    const { width } = LOGICAL_SIZE;
    for (const kind of ['rain', 'storm'] as const) {
      const look = WEATHER_LOOK[kind];
      const v = view(kind);
      const count = STREET_WEATHER.count[kind];
      const shown = fallShown(count, 'full', true, v);
      for (const [css, least] of [
        [844, 8],
        [693, 7],
      ] as const) {
        const height = heightOf(css);
        const band = flightClearBand(height);
        const halfLen = 45;
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
              const u = sideWarp(p.u, v.outside?.share ?? 0, v.outside?.stripShare ?? 0);
              const y = rainY(p.v, speed, t, height, halfLen);
              const slant = look.slant * (v.slantShare ?? 1);
              const x = rainX(u, slant, y, width, WEATHER_LOOK.rainWrapMarginPx);
              const alpha = flightRowShade(
                y,
                band,
                WEATHER_LOOK.bandFeatherPx,
                WEATHER_LOOK.flightRowAlpha,
              );
              // Counted where the player sees it: on the screen, not behind a HUD plate, under the awning.
              const seen = alpha > 0.4 && y > AWNING_BOTTOM_PX && onScreen(x, y, height);
              if (seen && (x <= towerLeft || x >= towerRight)) outside++;
            }
            lowest = Math.min(lowest, outside);
          }
        }
        expect(lowest, `${kind} on ${css}`).toBeGreaterThanOrEqual(least);
      }
    }
  });

  it('keeps enough flakes outside the tower at the worst moment on both screen heights', () => {
    const { width } = LOGICAL_SIZE;
    const snow = WEATHER_LOOK.snow;
    const v = view('snow');
    const count = STREET_WEATHER.count.snow;
    const lanes = laneCount(width, snow.laneGapPx);
    for (const [css, least] of [
      [844, 9],
      [693, 7],
    ] as const) {
      const height = heightOf(css);
      const band = flightClearBand(height);
      let lowest = Infinity;
      for (let seed = 1; seed <= 8; seed++) {
        const rng = new Rng(seed);
        const spots = snowSpots(
          count,
          lanes,
          () => startU(rng, v.sides?.bias ?? snow.sideBias, v.sides?.share ?? snow.sideShare),
          () => rng.next(),
        );
        const laneSpeed = new Map<number, number>();
        const flakes = spots.map((sp) => {
          const speed = laneSpeed.get(sp.lane) ?? rng.range(snow.speed[0], snow.speed[1]);
          laneSpeed.set(sp.lane, speed);
          return {
            ...sp,
            speed,
            sway: rng.range(snow.swayPx[0], snow.swayPx[1]),
            ms: rng.range(snow.swayMs[0], snow.swayMs[1]),
            phase: rng.next() * TWO_PI,
          };
        });
        for (let t = 0; t < 60; t += 0.25) {
          let outside = 0;
          for (const f of flakes) {
            const y = wrapRange(f.v * height + f.speed * t, height, 20);
            const x = f.u * width + f.sway * Math.sin((TWO_PI * t * 1000) / f.ms + f.phase);
            const alpha = flightRowShade(y, band, snow.bandFeatherPx, WEATHER_LOOK.flightRowAlpha);
            const seen = alpha > 0.4 && y > AWNING_BOTTOM_PX && onScreen(x, y, height);
            if (seen && (x <= towerLeft || x >= towerRight)) {
              outside++;
            }
          }
          lowest = Math.min(lowest, outside);
        }
      }
      expect(lowest, `snow on ${css}`).toBeGreaterThanOrEqual(least);
    }
  });

  it('hangs the street cloud bank below the awning and clear of the HUD plates', () => {
    const b = STREET_WEATHER.bank;
    let lowest = 0;
    for (const storm of [false, true]) {
      for (const drift of [-b.driftPx, 0, b.driftPx]) {
        for (let x = 0; x <= LOGICAL_SIZE.width; x += 4) {
          const px = (x - drift - LOGICAL_SIZE.width / 2) / b.scaleX + WEATHER_LOOK.bank.width / 2;
          const edge = bankEdge(px, storm) * b.scaleY;
          lowest = Math.max(lowest, edge);
          // The part of the lower edge that shows under the awning keeps its distance from every plate.
          if (edge <= AWNING_BOTTOM_PX) continue;
          for (const plate of HUD_LAYOUT.plates) {
            const dx = Math.max(plate.x - x, 0, x - plate.x - plate.width);
            const dy = Math.max(plate.y - edge, 0, edge - plate.y - plate.height);
            const gap = Math.hypot(dx, dy);
            expect(gap, `x ${x} drift ${drift} storm ${storm}`).toBeGreaterThanOrEqual(
              FLIGHT_CLEAR.hudGapPx - 2,
            );
          }
        }
      }
    }
    // It shows below the awning and never reaches the flight row of the shortest screen.
    expect(lowest).toBeGreaterThan(AWNING_BOTTOM_PX + 15);
    expect(lowest).toBeLessThan(flightClearBand(heightOf(693)).top);
  });

  it('draws bigger snow caps than before', () => {
    expect(STREET_WEATHER.cap.height).toBeGreaterThanOrEqual(28);
    expect(STREET_WEATHER.cap.awningHeight).toBeGreaterThanOrEqual(24);
  });
});
