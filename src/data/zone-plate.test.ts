import { describe, expect, it } from 'vitest';
import { ZONE_BANNER } from './zone-plate';

describe('ZONE_BANNER', () => {
  it('keeps the hanging plate above the flying layer', () => {
    const bottom = ZONE_BANNER.restY + (ZONE_BANNER.height + ZONE_BANNER.shadowOffset) / 2;
    expect(bottom + ZONE_BANNER.tiltDrop).toBeLessThanOrEqual(ZONE_BANNER.lowestEdgeY);
  });

  it('hangs fully on screen', () => {
    expect(ZONE_BANNER.restY - ZONE_BANNER.height / 2).toBeGreaterThan(0);
  });
});
