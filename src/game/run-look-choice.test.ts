import { beforeEach, describe, expect, it } from 'vitest';
import { pickStartPlace, pickWeather } from '../core/weather/run-look';
import { planetSeedOf } from '../core/zones/space-planet';
import { chooseRunLook, resetRunLookHistory } from './run-look-choice';

beforeEach(resetRunLookHistory);

describe('chooseRunLook', () => {
  it('the tutorial run is clear in the kitchen and leaves the history alone', () => {
    expect(chooseRunLook({ seed: 5, tutorial: true })).toEqual({
      weather: 'clear',
      place: 'kitchen',
      planetSeed: planetSeedOf(5),
    });
    expect(chooseRunLook({ seed: 5 }).weather).toBe(pickWeather(5, []));
  });

  it('the benchmark is clear + kitchen unless the parameters name them', () => {
    expect(chooseRunLook({ seed: 9, perf: {} })).toEqual({
      weather: 'clear',
      place: 'kitchen',
      planetSeed: planetSeedOf(9),
    });
    expect(chooseRunLook({ seed: 9, perf: { weather: 'rain', place: 'shop' } })).toEqual({
      weather: 'rain',
      place: 'shop',
      planetSeed: planetSeedOf(9),
    });
  });

  it('debug parameters pin one or both; the other still follows the seed', () => {
    expect(chooseRunLook({ seed: 7, debug: { weather: 'storm' } })).toEqual({
      weather: 'storm',
      place: pickStartPlace(7),
      planetSeed: planetSeedOf(7),
    });
    expect(chooseRunLook({ seed: 7, debug: { place: 'shop' } })).toEqual({
      weather: pickWeather(7, []),
      place: 'shop',
      planetSeed: planetSeedOf(7),
    });
  });

  it('the daily tower depends on the seed alone, whatever the session had', () => {
    for (let seed = 0; seed < 40; seed++) chooseRunLook({ seed });
    for (const seed of [11, 12, 13]) {
      expect(chooseRunLook({ seed, daily: true })).toEqual({
        weather: pickWeather(seed, []),
        place: pickStartPlace(seed),
        planetSeed: planetSeedOf(seed),
      });
    }
  });

  it('normal runs follow the history: never three equal non-clear in a row', () => {
    const weathers: string[] = [];
    for (let seed = 0; seed < 3000; seed++) weathers.push(chooseRunLook({ seed }).weather);
    for (let i = 2; i < weathers.length; i++) {
      if (weathers[i] === weathers[i - 1] && weathers[i] === weathers[i - 2]) {
        expect(weathers[i]).toBe('clear');
      }
    }
  });
});
