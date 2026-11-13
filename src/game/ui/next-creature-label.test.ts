import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from '../../i18n';
import { nextCreatureLabel } from './next-creature-label';

describe('nextCreatureLabel', () => {
  afterEach(() => setLang('en'));

  it('says "now" on the creature layer', () => {
    expect(nextCreatureLabel({ inLayers: 0 })).toBe('now');
    setLang('ru');
    expect(nextCreatureLabel({ inLayers: 0 })).toBe('сейчас');
  });

  it('counts layers with the English plural forms', () => {
    expect(nextCreatureLabel({ inLayers: 1 })).toBe('in 1 layer');
    expect(nextCreatureLabel({ inLayers: 2 })).toBe('in 2 layers');
    expect(nextCreatureLabel({ inLayers: 11 })).toBe('in 11 layers');
  });

  it('counts layers with the Russian plural forms', () => {
    setLang('ru');
    expect(nextCreatureLabel({ inLayers: 1 })).toBe('через 1 слой');
    expect(nextCreatureLabel({ inLayers: 3 })).toBe('через 3 слоя');
    expect(nextCreatureLabel({ inLayers: 5 })).toBe('через 5 слоёв');
    expect(nextCreatureLabel({ inLayers: 21 })).toBe('через 21 слой');
  });
});
