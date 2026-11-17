import { describe, expect, it } from 'vitest';
import { WEATHER } from '../../../data/weather';
import { weatherShareOf } from './weather-share';

describe('weatherShareOf', () => {
  it('is the alpha of the zones that show the view, and ignores the others', () => {
    const zones = [
      { zone: 'kitchen', alpha: 1 },
      { zone: 'showcase', alpha: 0 },
    ] as const;
    expect(weatherShareOf('window', zones, WEATHER.zoneView)).toBe(1);
    expect(weatherShareOf('full', zones, WEATHER.zoneView)).toBe(0);
  });

  it('crosses over smoothly from the window to the open sky and from it to nothing', () => {
    const toRoof = [
      { zone: 'showcase', alpha: 1 },
      { zone: 'roof', alpha: 0.25 },
    ] as const;
    expect(weatherShareOf('window', toRoof, WEATHER.zoneView)).toBe(1);
    expect(weatherShareOf('full', toRoof, WEATHER.zoneView)).toBe(0.25);
    const toStars = [
      { zone: 'clouds', alpha: 1 },
      { zone: 'stars', alpha: 0.6 },
    ] as const;
    expect(weatherShareOf('full', toStars, WEATHER.zoneView)).toBe(1);
  });

  it('adds zones of one view and clamps to 1', () => {
    const over = [
      { zone: 'roof', alpha: 1 },
      { zone: 'clouds', alpha: 0.5 },
    ] as const;
    expect(weatherShareOf('full', over, WEATHER.zoneView)).toBe(1);
    const under = [
      { zone: 'roof', alpha: 0.3 },
      { zone: 'clouds', alpha: 0.2 },
    ] as const;
    expect(weatherShareOf('full', under, WEATHER.zoneView)).toBeCloseTo(0.5);
  });
});
