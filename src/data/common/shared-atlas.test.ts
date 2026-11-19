import { describe, expect, it } from 'vitest';
import { SHARED_ATLAS } from './shared-atlas';

const onAtlas = (key: string): boolean =>
  !(SHARED_ATLAS.ownTexture as readonly string[]).includes(key) &&
  SHARED_ATLAS.keyPrefixes.some((prefix) => key.startsWith(prefix));

describe('shared atlas membership', () => {
  it('keeps the tall rarely drawn pictures off the page (they cost its tall shelves)', () => {
    for (const key of [
      'tr_cloud',
      'tr_nebula',
      'tr_lap_edge',
      'bd_mountains',
      'bd_planet_cookie',
    ]) {
      expect(onAtlas(key)).toBe(false);
    }
  });

  it('keeps layers and small effect pictures on the page', () => {
    for (const key of ['layer_5_720_n', 'tr_berry', 'fx_star', 'ui_hud_plate_680x158_fff6ec']) {
      expect(onAtlas(key)).toBe(true);
    }
  });
});
