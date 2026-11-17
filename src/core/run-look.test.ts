import { describe, expect, it } from 'vitest';
import { WEATHER, WEATHER_IDS, type WeatherId } from '../data/weather';
import { pickStartPlace, pickWeather } from './run-look';

const SEEDS = 20000;
const TOLERANCE_PERCENT = 1.5;

describe('pickWeather', () => {
  it('is deterministic for a seed and history', () => {
    for (let seed = 1; seed < 50; seed++) {
      expect(pickWeather(seed, [])).toBe(pickWeather(seed, []));
      expect(pickWeather(seed, ['rain', 'rain'])).toBe(pickWeather(seed, ['rain', 'rain']));
    }
  });

  it('follows the shares within tolerance over many seeds', () => {
    const counts = new Map<WeatherId, number>();
    for (let seed = 0; seed < SEEDS; seed++) {
      const id = pickWeather(seed * 7919 + 13, []);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    for (const id of WEATHER_IDS) {
      const percent = ((counts.get(id) ?? 0) / SEEDS) * 100;
      expect(Math.abs(percent - WEATHER.shares[id])).toBeLessThanOrEqual(TOLERANCE_PERCENT);
    }
  });

  it('never gives a third equal non-clear weather in a row', () => {
    for (const weather of WEATHER_IDS) {
      if (weather === 'clear') continue;
      for (let seed = 0; seed < 3000; seed++) {
        expect(pickWeather(seed, [weather, weather])).not.toBe(weather);
      }
    }
  });

  it('one equal weather before is no streak, and clear repeats freely', () => {
    const seen = new Set<WeatherId>();
    for (let seed = 0; seed < 3000; seed++) seen.add(pickWeather(seed, ['rain']));
    expect(seen.has('rain')).toBe(true);
    const clear = new Set<WeatherId>();
    for (let seed = 0; seed < 300; seed++) {
      clear.add(pickWeather(seed, ['clear', 'clear', 'clear']));
    }
    expect(clear.has('clear')).toBe(true);
  });

  it('a long session never has three equal non-clear in a row', () => {
    const history: WeatherId[] = [];
    for (let seed = 0; seed < 5000; seed++) {
      history.push(pickWeather(seed, history));
      const [a, b, c] = history.slice(-3);
      if (a && a === b && b === c) expect(a).toBe('clear');
    }
  });
});

describe('pickStartPlace', () => {
  it('is deterministic and about half kitchen, half shop', () => {
    let kitchen = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
      const place = pickStartPlace(seed * 104729 + 5);
      expect(pickStartPlace(seed * 104729 + 5)).toBe(place);
      if (place === 'kitchen') kitchen++;
    }
    expect(Math.abs((kitchen / SEEDS) * 100 - 50)).toBeLessThanOrEqual(TOLERANCE_PERCENT);
  });
});
