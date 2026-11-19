import { describe, expect, it } from 'vitest';
import { ANIM } from '../../../../data/common/anim';
import type { ZoneId } from '../../../../data/zones/zones';
import { haloZoneMult, zoneMixOf } from './zone-mix';

function mix(zones: readonly { zone: ZoneId; alpha: number }[]): number {
  return zoneMixOf(
    zones.keys(),
    zones.length - 1,
    (i) => zones[i]?.zone ?? 'kitchen',
    (i) => zones[i]?.alpha ?? 0,
    haloZoneMult,
  );
}

describe('halo multiplier by zone', () => {
  it('is half in Stars and Space and 1 elsewhere', () => {
    expect(ANIM.combo.haloZoneMult.stars).toBe(0.5);
    expect(haloZoneMult('stars')).toBe(0.5);
    expect(haloZoneMult('space')).toBe(0.5);
    for (const zone of ['kitchen', 'showcase', 'roof', 'clouds'] as const) {
      expect(haloZoneMult(zone)).toBe(1);
    }
  });

  it('follows the cross-fade into Stars instead of jumping', () => {
    const at = (alpha: number) =>
      mix([
        { zone: 'clouds', alpha: 1 },
        { zone: 'stars', alpha },
      ]);
    expect(at(0)).toBe(1);
    expect(at(0.5)).toBeCloseTo(0.75);
    expect(at(1)).toBe(0.5);
    expect(at(0.25)).toBeGreaterThan(at(0.75));
  });

  it('stays half between Stars and Space', () => {
    expect(
      mix([
        { zone: 'stars', alpha: 1 },
        { zone: 'space', alpha: 0.4 },
      ]),
    ).toBe(0.5);
  });
});
