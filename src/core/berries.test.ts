import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { berriesFromEvents } from './berries';
import type { SimEvent } from './tower-sim';

describe('berriesFromEvents', () => {
  const perfectGolden: SimEvent = { type: 'golden', perfect: true };

  it('pays a berry only for a perfect golden landing', () => {
    expect(berriesFromEvents([])).toBe(0);
    expect(berriesFromEvents([{ type: 'golden', perfect: false }])).toBe(0);
    expect(berriesFromEvents([perfectGolden])).toBe(BALANCE.golden.perfectBerries);
  });

  it('adds up several berries of one step', () => {
    expect(berriesFromEvents([perfectGolden, perfectGolden])).toBe(
      2 * BALANCE.golden.perfectBerries,
    );
  });
});
