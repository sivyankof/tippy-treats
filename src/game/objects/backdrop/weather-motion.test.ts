import { describe, expect, it } from 'vitest';
import { Rng } from '../../../core/rng';
import { BALANCE } from '../../../data/tower/balance';
import { LOGICAL_SIZE } from '../../../data/app/screen';
import { flightClearBand } from '../../camera-layout';
import { onScreen } from './weather-test-view';
import { WEATHER_LOOK } from '../../../data/weather/weather-look';
import {
  bankEdge,
  boltEnd,
  bankPuffs,
  flashEnvelope,
  nextBoltAt,
  rainDropsShown,
  flightRowShade,
  rainX,
  rainY,
  rainSpots,
  wrapPad,
  wrapRange,
} from './weather-motion';

describe('weather motion', () => {
  it('wraps a falling picture by its scaled half diagonal', () => {
    expect(wrapPad(6, 8, 1)).toBe(5);
    expect(wrapPad(6, 8, 0.5)).toBe(2.5);
    expect(wrapPad(0, 0, 2)).toBe(0);
  });

  it('leans a raindrop by its height, not by the time', () => {
    expect(rainX(0.5, 0.2, 0, 1000, 60)).toBe(500);
    expect(rainX(0.5, 0.2, 500, 1000, 60)).toBeCloseTo(600);
    expect(rainX(0.5, 0.2, -100, 1000, 60)).toBeCloseTo(480);
    // Leaning off one edge comes in at the other, beyond the screen.
    expect(rainX(1, 0.25, 400, 1000, 60)).toBeCloseTo(40);
  });

  it('spreads raindrops over the whole width at every height, in no columns', () => {
    const width = 1080;
    const margin = 30;
    for (const y of [0, 700, 2000]) {
      const xs = Array.from({ length: 120 }, (_, i) =>
        rainX((i + 0.5) / 120, 0.25, y, width, margin),
      );
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(-margin);
      expect(Math.max(...xs)).toBeLessThan(width + margin);
      // Every tenth of the width holds some drops (no empty middle).
      for (let k = 0; k < 10; k++) {
        const n = xs.filter((x) => x >= (k * width) / 10 && x < ((k + 1) * width) / 10).length;
        expect(n, `tenth ${k} at ${y}`).toBeGreaterThanOrEqual(6);
      }
    }
  });

  it('spreads raindrop spots evenly across and down the screen', () => {
    const rng = new Rng(3);
    const spots = rainSpots(37, () => rng.next());
    const cols = new Set(spots.map((p) => Math.floor(p.u * 12)));
    const rows = new Set(spots.map((p) => Math.floor(p.v * 37)));
    expect(cols.size).toBe(12);
    expect(rows.size).toBeGreaterThanOrEqual(30);
  });

  it('spreads any prefix of the drops evenly down the screen (lite shows only the first ones)', () => {
    const rng = new Rng(5);
    const spots = rainSpots(64, () => rng.next());
    for (const n of [8, 16, 32]) {
      const vs = spots
        .slice(0, n)
        .map((p) => p.v)
        .sort((x, y) => x - y);
      const gaps = vs.map((v, i) => (i === 0 ? v + 1 - vs[n - 1]! : v - vs[i - 1]!));
      // A plain order leaves half the height empty; any prefix here leaves at most about four drop spacings.
      expect(Math.max(...gaps)).toBeLessThan(4 / n);
    }
  });

  it('keeps enough raindrops visible beside the tower on every screen height, in rain and storm', () => {
    const { width } = LOGICAL_SIZE;
    const towerLeft = (width - BALANCE.tray.width) / 2;
    const towerRight = width - towerLeft;
    const halfLen = 45;
    for (const kind of ['rain', 'storm'] as const) {
      const look = WEATHER_LOOK[kind];
      const dim = WEATHER_LOOK.flightRowAlpha;
      const slant = look.slant;
      const shown = rainDropsShown(look.count, 'full');
      for (const [screen, minOutside] of [
        [844, 7],
        [693, 6],
      ] as const) {
        const height = Math.max(
          LOGICAL_SIZE.minHeight,
          Math.min(LOGICAL_SIZE.maxHeight, (LOGICAL_SIZE.width * screen) / 390),
        );
        const band = flightClearBand(height);
        const margin = WEATHER_LOOK.rainWrapMarginPx;
        let lowest = Infinity;
        let sum = 0;
        let nn = 0;
        for (let seed = 1; seed <= 12; seed++) {
          const rng = new Rng(seed);
          const spots = rainSpots(look.count, () => rng.next());
          const us = spots.map((p) => p.u);
          const vs = spots.map((p) => p.v);
          const speed = rng.range(look.speed[0], look.speed[1]);
          for (let t = 0; t < 60; t += 0.1) {
            let outside = 0;
            for (let i = 0; i < shown; i++) {
              const y = rainY(vs[i] ?? 0, speed, t, height, halfLen);
              const x = rainX(us[i] ?? 0, slant, y, width, margin);
              const alpha = flightRowShade(y, band, WEATHER_LOOK.bandFeatherPx, dim);
              // Counted where the player sees it: on the screen and not behind a HUD plate.
              const seen = alpha > 0.4 && onScreen(x, y, height);
              if (seen && ((x >= 0 && x <= towerLeft) || (x >= towerRight && x <= width))) {
                outside++;
              }
            }
            lowest = Math.min(lowest, outside);
            sum += outside;
            nn++;
          }
        }
        console.log(kind, screen, lowest, sum / nn);
        expect(lowest, `${kind} on ${screen}`).toBeGreaterThanOrEqual(minOutside);
      }
    }
  });

  it('wraps values into the padded range', () => {
    expect(wrapRange(-30, 100, 20)).toBe(-30 + 140);
    expect(wrapRange(130, 100, 20)).toBe(-10);
    expect(wrapRange(50, 100, 20)).toBe(50);
  });

  it('makes particles paler inside the flight row, with a smooth change at its edges and no fade elsewhere', () => {
    const band = { top: 400, bottom: 600 };
    expect(flightRowShade(500, band, 70, 0.5)).toBe(0.5);
    expect(flightRowShade(400, band, 70, 0.5)).toBe(0.5);
    expect(flightRowShade(365, band, 70, 0.5)).toBeCloseTo(0.75);
    expect(flightRowShade(635, band, 70, 0.5)).toBeCloseTo(0.75);
    expect(flightRowShade(100, band, 70, 0.5)).toBe(1);
    expect(flightRowShade(800, band, 70, 0.5)).toBe(1);
    // The top and the bottom of the screen are not faded.
    expect(flightRowShade(0, band, 70, 0.5)).toBe(1);
    expect(flightRowShade(-20, band, 70, 0.5)).toBe(1);
    // No step anywhere: a 1 px move never changes the alpha by more than the ramp allows.
    for (let y = 300; y < 700; y++) {
      const step = Math.abs(
        flightRowShade(y + 1, band, 70, 0.5) - flightRowShade(y, band, 70, 0.5),
      );
      expect(step).toBeLessThanOrEqual(0.5 / 70 + 1e-9);
    }
  });

  it('lets a raindrop fall from above the top edge to below the bottom one, wrapping off screen', () => {
    const height = 2340;
    const pad = 50;
    let highest = Infinity;
    let lowest = -Infinity;
    for (let t = 0; t < 3; t += 0.004) {
      const y = rainY(0.3, 1700, t, height, pad);
      highest = Math.min(highest, y);
      lowest = Math.max(lowest, y);
      expect(y).toBeGreaterThanOrEqual(-pad);
      expect(y).toBeLessThan(height + pad);
    }
    expect(highest).toBeLessThan(-pad + 10);
    expect(lowest).toBeGreaterThan(height + pad - 10);
  });

  it('places the next bolt inside the pause range', () => {
    expect(nextBoltAt(1000, [8000, 15000], 0)).toBe(9000);
    expect(nextBoltAt(1000, [8000, 15000], 1)).toBe(16000);
  });

  it('rises quickly and falls slowly', () => {
    expect(flashEnvelope(-1, 150)).toBe(0);
    expect(flashEnvelope(30, 150)).toBeCloseTo(1);
    expect(flashEnvelope(150, 150)).toBe(0);
    expect(flashEnvelope(90, 150)).toBeGreaterThan(0);
    expect(flashEnvelope(90, 150)).toBeLessThan(1);
  });

  it('finds the lower edge of the bank: high in the middle, low under the side puffs', () => {
    expect(bankEdge(500)).toBeLessThan(80);
    expect(bankEdge(500)).toBeLessThan(bankEdge(165) - 100);
    expect(bankEdge(165)).toBeGreaterThan(180);
    // The strip alone reaches this far where no puff stands.
    expect(bankEdge(-400)).toBe(WEATHER_LOOK.bank.topStripPx);
  });

  it('hangs the lower rows lower in a storm and keeps the back row and the middle', () => {
    expect(bankEdge(165, true)).toBeGreaterThan(bankEdge(165, false));
    expect(bankEdge(500, true)).toBe(bankEdge(500, false));
    const stormBack = bankPuffs(true).filter((p) => p.row === 0);
    const calmBack = bankPuffs(false).filter((p) => p.row === 0);
    expect(stormBack.map((p) => p.y)).toEqual(calmBack.map((p) => p.y));
  });
});

describe('boltEnd', () => {
  const plates = [
    { x: 24, y: 24, width: 96, height: 96 },
    { x: 186, y: 312, width: 708, height: 68 },
  ];
  it('stops the bolt above a plate it is level with', () => {
    expect(boltEnd(300, 40, 30, 330, plates, 40)).toBe(272);
  });
  it('leaves a bolt that is clear sideways alone and refuses one over a plate', () => {
    expect(boltEnd(300, 40, 30, 250, plates, 40)).toBe(250);
    expect(boltEnd(100, 40, 30, 250, plates, 40)).toBeNull();
  });
});

describe('particle limit', () => {
  it('keeps the raindrops and the splashes within the limit of every effects level', () => {
    const { particleCount, splash, rain, storm } = WEATHER_LOOK;
    for (const level of ['full', 'lite', 'minimal'] as const) {
      for (const pool of [rain.count, storm.count]) {
        expect(rainDropsShown(pool, level) + splash.maxShown[level]).toBeLessThanOrEqual(
          particleCount[level],
        );
      }
    }
    expect(rainDropsShown(rain.count, 'full')).toBe(37);
    expect(splash.max).toBeLessThanOrEqual(splash.maxShown.full);
  });
});
