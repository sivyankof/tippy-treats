import { describe, expect, it } from 'vitest';
import { WEATHER } from '../../../data/weather';
import type { ZoneId } from '../../../data/zones';
import { weatherShareOf } from './weather-share';

/** The share of a list of zones, with a zone's index in the list standing for it. */
function shareOf(
  view: 'full' | 'window',
  zones: readonly { zone: ZoneId; alpha: number }[],
): number {
  return weatherShareOf(
    view,
    zones.keys(),
    (i) => zones[i]?.zone ?? 'kitchen',
    (i) => zones[i]?.alpha ?? 0,
    WEATHER.zoneView,
  );
}

describe('weatherShareOf', () => {
  it('is the alpha of the zones that show the view, and ignores the others', () => {
    const zones = [
      { zone: 'kitchen', alpha: 1 },
      { zone: 'showcase', alpha: 0 },
    ] as const;
    expect(shareOf('window', zones)).toBe(1);
    expect(shareOf('full', zones)).toBe(0);
  });

  it('crosses over smoothly from the window to the open sky and from it to nothing', () => {
    const toRoof = [
      { zone: 'showcase', alpha: 1 },
      { zone: 'roof', alpha: 0.25 },
    ] as const;
    expect(shareOf('window', toRoof)).toBe(1);
    expect(shareOf('full', toRoof)).toBe(0.25);
    const toStars = [
      { zone: 'clouds', alpha: 1 },
      { zone: 'stars', alpha: 0.6 },
    ] as const;
    expect(shareOf('full', toStars)).toBe(1);
  });

  it('adds zones of one view and clamps to 1', () => {
    const over = [
      { zone: 'roof', alpha: 1 },
      { zone: 'clouds', alpha: 0.5 },
    ] as const;
    expect(shareOf('full', over)).toBe(1);
    const under = [
      { zone: 'roof', alpha: 0.3 },
      { zone: 'clouds', alpha: 0.2 },
    ] as const;
    expect(shareOf('full', under)).toBeCloseTo(0.5);
  });
});
