import { describe, expect, it } from 'vitest';
import { Rng } from '../../../core/rng';
import { BALANCE } from '../../../data/balance';
import { LOGICAL_SIZE } from '../../../data/screen';
import { HUD_LAYOUT } from '../../../data/hud-layout';
import { flightClearBand, hudFloor } from '../../camera-layout';
import { FLIGHT_CLEAR } from '../../../data/flight-clear';
import { WEATHER_LOOK } from '../../../data/weather-look';
import { clamp01 } from '../../../util/math';
import {
  bankEdge,
  boltEnd,
  bankPuffs,
  flashEnvelope,
  nextBoltAt,
  rainDropsShown,
  particleFade,
  particleKeepOut,
  rainDrift,
  rainSlope,
  rainStartX,
  rainX,
  rainY,
  rainSpots,
  wrapRange,
} from './weather-motion';

describe('weather motion', () => {
  it('leans a raindrop by its height, not by the time', () => {
    expect(rainX(500, 0.2, 500, 500)).toBe(500);
    expect(rainX(500, 0.2, 1000, 500)).toBeCloseTo(600);
    expect(rainX(500, 0.2, 0, 500)).toBeCloseTo(400);
  });

  it('starts raindrops beside the tower, widened by the drift, and the rest anywhere', () => {
    const width = 1080;
    const outer = 180;
    const drift = 150;
    const xs = Array.from({ length: 100 }, (_, i) =>
      rainStartX((i + 0.5) / 100, width, outer, drift, 0.7),
    );
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(-drift);
    expect(Math.max(...xs)).toBeLessThanOrEqual(width + drift);
    expect(xs.filter((x) => x < outer || x > width - outer)).toHaveLength(70);
    expect(xs.some((x) => x < 0)).toBe(true);
    expect(xs.some((x) => x > width)).toBe(true);
  });

  it('spreads raindrop spots evenly across and down the screen', () => {
    const rng = new Rng(3);
    const spots = rainSpots(37, () => rng.next());
    const cols = new Set(spots.map((p) => Math.floor(p.u * 12)));
    const rows = new Set(spots.map((p) => Math.floor(p.v * 37)));
    expect(cols.size).toBe(12);
    expect(rows.size).toBeGreaterThanOrEqual(30);
  });

  it('keeps enough raindrops visible beside the tower on every screen height, in rain and storm', () => {
    const { width } = LOGICAL_SIZE;
    const towerLeft = (width - BALANCE.tray.width) / 2;
    const towerRight = width - towerLeft;
    const pad = WEATHER_LOOK.endFeatherPx;
    const reach = 12;
    const halfLen = 45;
    for (const kind of ['rain', 'storm'] as const) {
      const look = WEATHER_LOOK[kind];
      const slant = look.slant;
      const rotation = -Math.atan(rainSlope(slant));
      const shown = rainDropsShown(look.count, 'full');
      for (const [screen, minOutside] of [
        [844, 8],
        [693, 6],
      ] as const) {
        const height = Math.max(
          LOGICAL_SIZE.minHeight,
          Math.min(LOGICAL_SIZE.maxHeight, (LOGICAL_SIZE.width * screen) / 390),
        );
        const band = flightClearBand(height);
        const top = hudFloor();
        const drift = rainDrift(slant, height - top, pad);
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
              const y = rainY(vs[i] ?? 0, speed, t, top, height, pad, band);
              const xMid = rainStartX(
                us[i] ?? 0,
                width,
                towerLeft,
                drift,
                WEATHER_LOOK.rainSideBias,
              );
              const x = rainX(xMid, slant, y, (top + height) / 2);
              const alpha =
                clamp01((y - top) / pad) *
                particleFade(y, band, WEATHER_LOOK.bandFeatherPx, height, pad) *
                particleKeepOut(x, y, WEATHER_LOOK.keepOutFeatherPx, reach, halfLen, rotation);
              if (alpha > 0.4 && ((x >= 0 && x <= towerLeft) || (x >= towerRight && x <= width))) {
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

  it('hides particles inside the flight stripe and fades them in beside it', () => {
    const band = { top: 400, bottom: 600 };
    expect(particleFade(500, band, 70, 1000, 60)).toBe(0);
    expect(particleFade(365, band, 70, 1000, 60)).toBeCloseTo(0.5);
    expect(particleFade(100, band, 70, 1000, 60)).toBe(1);
    expect(particleFade(800, band, 70, 1000, 60)).toBe(1);
    expect(particleFade(10, band, 70, 1000, 60)).toBeCloseTo(10 / 60);
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

describe('particleKeepOut', () => {
  it('is fully transparent within the HUD gap of every plate, snow feather included', () => {
    for (const plate of HUD_LAYOUT.plates) {
      const y = plate.y + plate.height / 2;
      for (const away of [0, 25, 35, 39, FLIGHT_CLEAR.hudGapPx]) {
        for (const feather of [12, WEATHER_LOOK.keepOutFeatherPx]) {
          expect(particleKeepOut(plate.x + plate.width + away, y, feather)).toBe(0);
          expect(particleKeepOut(plate.x - away, y, feather)).toBe(0);
        }
      }
    }
  });

  it('starts to fade in only past the gap and the margin', () => {
    const plate = HUD_LAYOUT.plates[1];
    if (!plate) throw new Error('no plate');
    const y = plate.y + plate.height / 2;
    const edge = plate.x + plate.width + FLIGHT_CLEAR.hudGapPx + WEATHER_LOOK.keepOutMarginPx;
    expect(particleKeepOut(edge, y, 12)).toBe(0);
    expect(particleKeepOut(edge + 6, y, 12)).toBeGreaterThan(0);
    expect(particleKeepOut(edge + 40, y, 12)).toBe(1);
  });

  it('counts the whole picture: a 44 px flake with its edge 1 px inside the gap is fully transparent', () => {
    const plate = HUD_LAYOUT.plates[1];
    if (!plate) throw new Error('no plate');
    const y = plate.y + plate.height / 2;
    const radius = 22;
    const edge = plate.x + plate.width + FLIGHT_CLEAR.hudGapPx + WEATHER_LOOK.keepOutMarginPx;
    // Centre far enough that only the flake's edge reaches 1 px into the gap + margin.
    expect(particleKeepOut(edge + radius - 1, y, 12, radius)).toBe(0);
    expect(particleKeepOut(edge + radius + 1, y, 12, radius)).toBeGreaterThan(0);
    // The same centre with no extent counted would still be visible.
    expect(particleKeepOut(edge + radius - 1, y, 12)).toBeGreaterThan(0);
  });

  it('counts the length of a slanted raindrop: a tail that crosses the gap makes the whole drop transparent', () => {
    const plate = HUD_LAYOUT.plates[1];
    if (!plate) throw new Error('no plate');
    const halfLen = 40;
    const rotation = -0.3;
    const clear = FLIGHT_CLEAR.hudGapPx + WEATHER_LOOK.keepOutMarginPx;
    // The drop's top end (centre minus the axis) is the one nearest the plate; put it 1 px inside the clear zone.
    const top = { x: -Math.sin(rotation) * -halfLen, y: Math.cos(rotation) * -halfLen };
    const x = plate.x + plate.width + clear - 1 - top.x;
    const y = plate.y + plate.height / 2 - top.y;
    expect(particleKeepOut(x, y, 12, 0, halfLen, rotation)).toBe(0);
    // Counting only its centre the drop would be shown.
    expect(particleKeepOut(x, y, 12)).toBeGreaterThan(0);
    // Far from every plate it is untouched.
    expect(particleKeepOut(plate.x + plate.width / 2, 2000, 12, 5, halfLen, rotation)).toBe(1);
  });
});
