import { describe, expect, it } from 'vitest';
import { CREATURE_IDS, CREATURES } from '../data/creatures';
import { DICTIONARIES, keysOf } from './index';
import { ABILITIES } from '../core/abilities/registry';

describe('creature data integrity', () => {
  it('has a name, a description and a trait in every language', () => {
    for (const lang of ['en', 'ru'] as const) {
      const keys = new Set(keysOf(DICTIONARIES[lang]));
      for (const id of CREATURE_IDS) {
        expect(keys.has(CREATURES[id].nameKey), `${lang} ${CREATURES[id].nameKey}`).toBe(true);
        expect(keys.has(CREATURES[id].descKey), `${lang} ${CREATURES[id].descKey}`).toBe(true);
        expect(keys.has(CREATURES[id].traitKey), `${lang} ${CREATURES[id].traitKey}`).toBe(true);
      }
    }
  });

  it('has an ability in the registry for every creature', () => {
    for (const id of CREATURE_IDS) expect(ABILITIES[id].id).toBe(id);
  });
});
