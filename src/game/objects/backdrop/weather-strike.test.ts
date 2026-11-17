import { describe, expect, it } from 'vitest';
import { bankFlashKey } from './weather-art';
import { STRIKE_SIDES, WEATHER_LOOK, WEATHER_TEX } from '../../../data/weather-look';

describe('strike sides', () => {
  it('give the bolt ranges, the flash spots and the flash pictures one entry each', () => {
    const n = STRIKE_SIDES.length;
    expect(WEATHER_LOOK.lightning.xRanges).toHaveLength(n);
    expect(WEATHER_LOOK.bank.flashSpots).toHaveLength(n);
    expect(WEATHER_TEX.bankFlash).toHaveLength(n);
    for (let side = 0; side < n; side++) expect(bankFlashKey(side)).not.toBe('');
  });
});
