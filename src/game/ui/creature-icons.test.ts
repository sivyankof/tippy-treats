import { describe, expect, it } from 'vitest';
import { CREATURE_IDS } from '../../data/creatures';
import { CREATURE_ICON_KEYS } from './creature-icons';

const SOURCES = import.meta.glob<string>('../../../assets/svg/icon_*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
});

describe('creature icons', () => {
  it('has a texture key and an SVG file for every creature', () => {
    for (const id of CREATURE_IDS) {
      const key = CREATURE_ICON_KEYS[id];
      expect(key).toBe(`icon_${id}`);
      const source = SOURCES[`../../../assets/svg/${key}.svg`];
      expect(source, key).toBeDefined();
      expect(source).toContain('viewBox="0 0 64 64"');
    }
    expect(Object.keys(SOURCES)).toHaveLength(CREATURE_IDS.length);
  });
});
