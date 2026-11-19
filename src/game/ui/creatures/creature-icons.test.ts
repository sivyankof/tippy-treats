import { describe, expect, it } from 'vitest';
import { CREATURE_IDS } from '../../../data/creatures/creatures';
import { CREATURE_ICON_KEYS } from './creature-icons';

describe('creature icons', () => {
  it('has a unique texture key for every creature', () => {
    for (const id of CREATURE_IDS) expect(CREATURE_ICON_KEYS[id]).toBe(`icon_${id}`);
    expect(new Set(Object.values(CREATURE_ICON_KEYS)).size).toBe(CREATURE_IDS.length);
  });
});
