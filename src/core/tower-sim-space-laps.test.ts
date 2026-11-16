import { describe, expect, it } from 'vitest';
import { BALANCE } from '../data/balance';
import { config, mutable, only, pick, untilFlying, untilSettled } from './sim-test-utils';
import type { SimEvent } from './sim-types';
import { spaceWidthLimit } from './space-laps';
import { TowerSim } from './tower-sim';

const newSim = (startHeight: number): TowerSim =>
  new TowerSim(config({ seed: 77, startHeight }));

function perfect(sim: TowerSim): SimEvent[] {
  const events = untilFlying(sim);
  const flying = mutable(sim).flying;
  if (flying) flying.x = sim.topLayerX();
  sim.drop();
  events.push(...untilSettled(sim));
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

  it('never lets a perfect streak widen a layer beyond the lap cap', () => {
    const sim = newSim(120);
    for (let i = 0; i < 8; i++) perfect(sim);
    const cap = spaceWidthLimit(sim.state.height);
    for (const layer of sim.state.layers.slice(120)) {
      expect(layer.width).toBeLessThanOrEqual(cap + 1e-9);
    }
  });
});
