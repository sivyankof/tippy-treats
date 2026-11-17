import { describe, expect, it } from 'vitest';
import { WEATHER_LOOK } from '../../../data/weather-look';
import {
  bankEdge,
  boltEnd,
  bankPuffs,
  flashEnvelope,
  nextBoltAt,
  particleFade,
  wrapRange,
} from './weather-motion';

describe('weather motion', () => {
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
