import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../data/tower/balance';
import { config, mutable, only, pick, untilFlying, untilSettled } from './sim-test-utils';
import type { SimEvent } from './sim-types';
import { spaceWidthLimit } from '../zones/space-laps';
import { TowerSim } from './tower-sim';

const newSim = (startHeight: number): TowerSim => new TowerSim(config({ seed: 77, startHeight }));

/** Drops the layer already in the air exactly over the tower top. */
function perfectNow(sim: TowerSim): SimEvent[] {
  const flying = mutable(sim).flying;
  if (flying) flying.x = sim.topLayerX();
  sim.drop();
  return untilSettled(sim);
}

function perfect(sim: TowerSim): SimEvent[] {
  const events = untilFlying(sim);
  events.push(...perfectNow(sim));
  return events;
}

describe('TowerSim: lap narrowing of Space', () => {
  it('keeps the full width on lap 1', () => {
    const sim = newSim(100);
    const spawn = only(untilFlying(sim), 'spawn').layer;
    expect(spawn.width).toBe(BALANCE.layer.maxWidth);
    expect(sim.state.widthCap).toBe(BALANCE.layer.maxWidth);
  });

  it('trims a layer wider than the lap cap evenly when it spawns, with no piece and no wobble', () => {
    const sim = newSim(120);
    const wobble = sim.state.wobble;
    const events = untilFlying(sim);
    const cap = spaceWidthLimit(121);
    expect(cap).toBeLessThan(BALANCE.layer.maxWidth);
    expect(only(events, 'spawn').layer.width).toBeCloseTo(cap);
    expect(pick(events, 'land')).toHaveLength(0);
    expect(sim.state.wobble).toBe(wobble);
    // The layers already on the tower keep their width.
    expect(sim.state.layers.at(-1)?.width).toBe(BALANCE.layer.firstWidth);
  });

  it('lets a perfect streak widen a narrower layer up to the lap cap, never beyond', () => {
    const sim = newSim(120);
    const cap = spaceWidthLimit(121);
    untilFlying(sim);
    const flying = mutable(sim).flying;
    if (flying) flying.width = cap - 100;
    const events: SimEvent[] = [];
    mutable(sim).wobble = 0;
    events.push(...perfectNow(sim));
    for (let i = 0; i < 6; i++) {
      mutable(sim).wobble = 0;
      events.push(...perfect(sim));
    }
    const combos = pick(events, 'combo');
    expect(combos).toHaveLength(7);
    expect(combos.some((e) => e.widened > 0)).toBe(true);
    const widths = sim.state.layers.slice(120).map((layer) => layer.width);
    expect(Math.max(...widths)).toBeCloseTo(cap);
    for (const width of widths) expect(width).toBeLessThanOrEqual(cap + 1e-9);
  });
});
