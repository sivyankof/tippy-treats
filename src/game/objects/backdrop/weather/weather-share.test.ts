import { describe, expect, it } from 'vitest';
import { WEATHER } from '../../../../data/weather/weather';
import type { ZoneId } from '../../../../data/zones/zones';
import { towerWeatherShown, weatherShareOf, zoneShowsWeatherSky } from './weather-share';

/** The share of a list of zones, with a zone's index in the list standing for it; the last one is the zone being flowed into. */
function shareOf(
  view: 'full' | 'window',
  zones: readonly { zone: ZoneId; alpha: number }[],
): number {
  return weatherShareOf(
    view,
    zones.keys(),
    zones.length - 1,
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
    expect(shareOf('window', toRoof)).toBe(0.75);
    expect(shareOf('full', toRoof)).toBe(0.25);
    const toStars = [
      { zone: 'clouds', alpha: 1 },
      { zone: 'stars', alpha: 0.6 },
    ] as const;
    expect(shareOf('full', toStars)).toBeCloseTo(0.4);
  });

  it('adds zones of one view and clamps to 1', () => {
    const over = [
      { zone: 'roof', alpha: 1 },
      { zone: 'clouds', alpha: 0.5 },
    ] as const;
    expect(shareOf('full', over)).toBe(1);
    const under = [
      { zone: 'roof', alpha: 1 },
      { zone: 'clouds', alpha: 0.2 },
    ] as const;
    expect(shareOf('full', under)).toBeCloseTo(1);
  });
});

describe('zones without weather', () => {
  const none = (Object.keys(WEATHER.zoneView) as ZoneId[]).filter(
    (zone) => WEATHER.zoneView[zone] === 'none',
  );

  it('are the Stars and Space zones', () => {
    expect(none).toEqual(['stars', 'space']);
  });

  it('let no weather through at full strength: no particles, snow cap, splashes or lightning', () => {
    for (const zone of none) {
      const alone = [{ zone, alpha: 1 }] as const;
      expect(shareOf('full', alone)).toBe(0);
      expect(shareOf('window', alone)).toBe(0);
      expect(towerWeatherShown(shareOf('full', alone), 40, false)).toBe(false);
    }
  });

  it('have no cloud bank or bolt in the sky', () => {
    for (const zone of none) expect(zoneShowsWeatherSky(zone)).toBe(false);
    expect(zoneShowsWeatherSky('roof')).toBe(true);
    expect(zoneShowsWeatherSky('clouds')).toBe(true);
    expect(zoneShowsWeatherSky('kitchen')).toBe(false);
  });

  it('fade the tower pieces out with the Clouds zone when the Stars zone comes in', () => {
    const fading = [
      { zone: 'clouds', alpha: 1 },
      { zone: 'stars', alpha: 0.6 },
    ] as const;
    expect(towerWeatherShown(shareOf('full', fading), 80, false)).toBe(true);
    expect(shareOf('full', fading)).toBeCloseTo(0.4);
    const gone = [
      { zone: 'clouds', alpha: 0 },
      { zone: 'stars', alpha: 1 },
    ] as const;
    expect(towerWeatherShown(shareOf('full', gone), 80, false)).toBe(false);
  });

  it('let the particle share follow the cloud bank: gone once the stars have covered it', () => {
    // The bank is drawn in the old zone, which the new one covers by its alpha; the particles use the share.
    for (let a = 0; a <= 1.0001; a += 0.05) {
      const step = [
        { zone: 'clouds', alpha: 1 },
        { zone: 'stars', alpha: a },
      ] as const;
      const bankVisible = 1 - a;
      expect(shareOf('full', step)).toBeCloseTo(bankVisible);
    }
    const covered = [
      { zone: 'clouds', alpha: 1 },
      { zone: 'stars', alpha: 1 },
    ] as const;
    expect(shareOf('full', covered)).toBe(0);
    expect(towerWeatherShown(shareOf('full', covered), 83, false)).toBe(false);
  });

  it('show no tower pieces when the tower is gone or over', () => {
    expect(towerWeatherShown(1, 0, false)).toBe(false);
    expect(towerWeatherShown(1, 10, true)).toBe(false);
    expect(towerWeatherShown(1, 10, false)).toBe(true);
  });
});
