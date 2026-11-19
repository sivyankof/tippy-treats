import { describe, expect, it } from 'vitest';
import { WEATHER_BED } from '../../data/audio/weather-bed';
import { bedWanted } from './weather-bed';

describe('bedWanted', () => {
  it('is off in the game by default (the owner decides)', () => {
    expect(WEATHER_BED.enabled).toBe(false);
    expect(bedWanted('rain', 1, 'full')).toBeNull();
  });

  it('picks the bed of the weather when the switch is on', () => {
    expect(bedWanted('rain', 1, 'full', true)).toBe('rain');
    expect(bedWanted('storm', 0.5, 'lite', true)).toBe('storm');
    expect(bedWanted('snow', 1, 'full', true)).toBe('wind');
  });

  it('has no bed for the weathers that have none', () => {
    for (const weather of ['clear', 'sunset', 'night', 'leaves'] as const) {
      expect(bedWanted(weather, 1, 'full', true)).toBeNull();
    }
  });

  it('never plays on the minimal level or when the weather is out of sight', () => {
    expect(bedWanted('rain', 1, 'minimal', true)).toBeNull();
    expect(bedWanted('rain', 0, 'full', true)).toBeNull();
  });
});
