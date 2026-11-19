import { describe, expect, it } from 'vitest';
import { CREATURE_IDS, CREATURES } from '../data/creatures/creatures';
import { DICTIONARIES, keysOf, setLang, t } from './index';
import { ABILITIES } from '../core/abilities/registry';
import { masterInfo, perksAt } from '../core/creatures/mastery';

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

  it('has the master effect name and phrase of every creature, every number filled in', () => {
    for (const lang of ['en', 'ru'] as const) {
      setLang(lang);
      const keys = new Set(keysOf(DICTIONARIES[lang]));
      for (const id of CREATURE_IDS) {
        const info = masterInfo(id);
        expect(keys.has(info.nameKey), `${lang} ${info.nameKey}`).toBe(true);
        expect(keys.has(info.shortKey), `${lang} ${info.shortKey}`).toBe(true);
        expect(t(info.shortKey, info.values), `${lang} ${id}`).not.toMatch(/\{\w+\}/);
      }
      for (const key of ['mastery.newLook', 'mastery.master']) {
        expect(keys.has(key), `${lang} ${key}`).toBe(true);
      }
    }
    setLang('en');
  });

  it('has a line for every ladder property, every number filled in', () => {
    for (const lang of ['en', 'ru'] as const) {
      setLang(lang);
      for (const id of CREATURE_IDS) {
        for (const perk of perksAt(id, 5)) {
          const key = `mastery.perk.${perk.id}`;
          expect(keysOf(DICTIONARIES[lang]).includes(key), `${lang} ${key}`).toBe(true);
          expect(t(key, perk.values), `${lang} ${key}`).not.toMatch(/\{\w+\}/);
        }
      }
    }
    setLang('en');
  });

  it('has an ability in the registry for every creature', () => {
    for (const id of CREATURE_IDS) expect(ABILITIES[id].id).toBe(id);
  });
});
